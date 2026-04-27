import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";

const ALLOWED_STATUSES = ["pending", "approved", "rejected", "cancelled"];

function getAccessTokenFromHeader(request) {
  const authorizationHeader = request.headers.get("authorization") || "";
  if (!authorizationHeader.startsWith("Bearer ")) return "";
  return authorizationHeader.slice(7).trim();
}

function parseBookingId(id) {
  const match = /^(lab|equipment)-(\d+)$/.exec(id || "");

  if (!match) {
    return null;
  }

  const bookingType = match[1];
  return {
    bookingType,
    sourceId: Number(match[2]),
    tableName: bookingType === "lab" ? "lab_bookings" : "equipment_bookings",
    itemColumn: bookingType === "lab" ? "lab_id" : "equipment_id",
  };
}

async function resolveUserProfile(accessToken) {
  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);

  if (authError || !authData?.user?.email) {
    return {
      error: { status: 401, message: "Unauthorized. Please log in again." },
    };
  }

  const scopedClient = getSupabaseServerClient(accessToken);
  const { data: profile, error: profileError } = await scopedClient
    .from("users")
    .select("id, email, role")
    .eq("email", authData.user.email)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: { status: 403, message: "Could not verify your account." } };
  }

  return { profile };
}

async function enrichBooking(admin, booking) {
  if (!booking) {
    return null;
  }

  const tableName = booking.booking_type === "lab" ? "labs" : "equipment";
  const fallbackType = booking.booking_type === "lab" ? "Lab" : "Equipment";
  const { data: item, error } = await admin
    .from(tableName)
    .select("id, name, location, course")
    .eq("id", booking.item_id)
    .maybeSingle();

  if (error) {
    console.error(`Error enriching ${booking.booking_type} booking:`, error);
  }

  const subtitle = [item?.course, item?.location].filter(Boolean).join(" | ");

  return {
    ...booking,
    resource_name: item?.name || `${fallbackType} ${booking.item_id}`,
    resource_subtitle: subtitle || booking.item_id,
  };
}

async function getSourceBooking(admin, parsedBooking) {
  const selectColumns = `id, user_id, status, booking_date, start_time, end_time, ${parsedBooking.itemColumn}`;
  const { data, error } = await admin
    .from(parsedBooking.tableName)
    .select(selectColumns)
    .eq("id", parsedBooking.sourceId)
    .maybeSingle();

  return { data, error };
}

async function hasScheduleConflict({
  admin,
  parsedBooking,
  currentBooking,
  bookingDate,
  startTime,
  endTime,
}) {
  const { data, error } = await admin
    .from(parsedBooking.tableName)
    .select("id")
    .eq(parsedBooking.itemColumn, currentBooking[parsedBooking.itemColumn])
    .eq("booking_date", bookingDate)
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .in("status", ["pending", "approved"])
    .neq("id", parsedBooking.sourceId)
    .limit(1)
    .maybeSingle();

  return { conflict: data, error };
}

export async function GET(request, { params }) {
  try {
    const accessToken = getAccessTokenFromHeader(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Missing access token." },
        { status: 401 },
      );
    }

    const { profile, error } = await resolveUserProfile(accessToken);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const { id } = await params;
    const admin = getSupabaseAdminClient();

    const { data: booking, error: fetchError } = await admin
      .from("bookings")
      .select("id, booking_type, item_id, user_id, booking_date, start_time, end_time, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.user_id !== profile.id) {
      return NextResponse.json(
        { error: "You do not have permission to view this booking." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { booking: await enrichBooking(admin, booking) },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/bookings/[id]:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const accessToken = getAccessTokenFromHeader(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Missing access token." },
        { status: 401 },
      );
    }

    const { profile, error } = await resolveUserProfile(accessToken);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const { id } = await params;
    const parsedBooking = parseBookingId(id);

    if (!parsedBooking) {
      return NextResponse.json({ error: "Invalid booking ID." }, { status: 400 });
    }

    const body = await request.json();
    const { status, booking_date, start_time, end_time } = body;
    const admin = getSupabaseAdminClient();
    const { data: existing, error: fetchError } = await getSourceBooking(
      admin,
      parsedBooking,
    );

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (existing.user_id !== profile.id) {
      return NextResponse.json(
        { error: "You do not have permission to update this booking." },
        { status: 403 },
      );
    }

    if (existing.status === "cancelled") {
      return NextResponse.json(
        { error: "This booking is already cancelled." },
        { status: 400 },
      );
    }

    const updates = {};

    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: "Invalid status value." },
          { status: 400 },
        );
      }
      updates.status = status;
    }

    const nextBookingDate = booking_date || existing.booking_date;
    const nextStartTime = start_time || existing.start_time;
    const nextEndTime = end_time || existing.end_time;
    const isRescheduling = Boolean(booking_date || start_time || end_time);

    if (isRescheduling) {
      if (nextStartTime >= nextEndTime) {
        return NextResponse.json(
          { error: "End time must be after start time." },
          { status: 400 },
        );
      }

      const { conflict, error: conflictError } = await hasScheduleConflict({
        admin,
        parsedBooking,
        currentBooking: existing,
        bookingDate: nextBookingDate,
        startTime: nextStartTime,
        endTime: nextEndTime,
      });

      if (conflictError) {
        console.error("Error checking booking conflict:", conflictError);
        return NextResponse.json(
          { error: "Could not check booking availability." },
          { status: 500 },
        );
      }

      if (conflict) {
        return NextResponse.json(
          { error: "Time slot not available. Please select another time." },
          { status: 409 },
        );
      }

      updates.booking_date = nextBookingDate;
      updates.start_time = nextStartTime;
      updates.end_time = nextEndTime;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No booking updates provided." },
        { status: 400 },
      );
    }

    const { data: updated, error: updateError } = await admin
      .from(parsedBooking.tableName)
      .update(updates)
      .eq("id", parsedBooking.sourceId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error("Error updating booking:", updateError);
      return NextResponse.json(
        { error: "Could not update booking." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Booking updated successfully.", booking: updated },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/bookings/[id]:", error);
    return NextResponse.json(
      { error: "Something went wrong while updating the booking." },
      { status: 500 },
    );
  }
}
