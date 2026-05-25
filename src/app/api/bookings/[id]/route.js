import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";

const ALLOWED_STATUSES = ["cancelled"];

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

async function getBookingProcess(admin, type, bookingId) {
  const { data, error } = await admin
    .from("booking_process")
    .select("*")
    .eq("booking_type", type)
    .eq("booking_id", bookingId)
    .order("decision_at", { ascending: false });

  if (error) {
    console.error("Error fetching booking process:", error);
    return [];
  }

  return data || [];
}

async function getUsersByIds(admin, userIds) {
  if (!userIds || userIds.length === 0) return [];

  const { data, error } = await admin
    .from("users")
    .select("id, username, email, role")
    .in("id", userIds);

  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }

  return data || [];
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
      .select(
        "id, booking_type, item_id, user_id, booking_date, start_time, end_time, status, grant_number, vot_number, total_price, created_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("Database error fetching booking:", fetchError);
      return NextResponse.json({ error: "Database error fetching booking." }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.user_id !== profile.id) {
      return NextResponse.json(
        { error: "You do not have permission to view this booking." },
        { status: 403 },
      );
    }

    const parsedId = parseBookingId(id);
    const sourceId = parsedId?.sourceId;

    // Get approval process data
    const processRecords = sourceId
      ? await getBookingProcess(admin, booking.booking_type, sourceId)
      : [];

    // Get user details
    const reviewerIds = processRecords.map((p) => p.reviewer_id).filter(Boolean);
    const userIds = [...new Set([booking.user_id, ...reviewerIds])];
    const users = await getUsersByIds(admin, userIds);

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const bookingUser = userMap[booking.user_id];

    // Get PIC token details - find token assigned to this user
    const { data: picTokenData } = await admin
      .from("pic_tokens")
      .select("token, created_at, expires_at, assigned_by")
      .eq("assigned_to", booking.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get PIC user details if token exists
    let picUser = null;
    if (picTokenData?.assigned_by) {
      const { data: picUserData } = await admin
        .from("users")
        .select("id, username, email")
        .eq("id", picTokenData.assigned_by)
        .maybeSingle();
      picUser = picUserData;
    }

    // Format approval process data
    const unitLeaderReview = processRecords.find(
      (p) => p.reviewer_role === "unit_leader" && p.decision,
    );
    const ppmuReview = processRecords.find(
      (p) => p.reviewer_role === "ppmu" && p.decision,
    );

    const enrichedBooking = await enrichBooking(admin, booking);

    // Get booking reason from source table
    const sourceTable = booking.booking_type === "lab" ? "lab_bookings" : "equipment_bookings";
    const { data: sourceBooking } = await admin
      .from(sourceTable)
      .select("booking_reason")
      .eq("id", sourceId)
      .maybeSingle();

    const response = {
      booking: {
        ...enrichedBooking,
        reason: sourceBooking?.booking_reason || "No reason provided",
      },
      user: bookingUser
        ? {
            name: bookingUser.username || "N/A",
            email: bookingUser.email || "N/A",
            role: bookingUser.role || "N/A",
          }
        : null,
      pic: picTokenData
        ? {
            username: picUser?.username || "N/A",
            email: picUser?.email || "N/A",
            token: `PIC-${new Date(picTokenData.created_at).getFullYear()}-${picTokenData.token}`,
            rawToken: picTokenData.token,
            generatedAt: picTokenData.created_at,
            expiresAt: picTokenData.expires_at,
          }
        : null,
      unitLeaderReview: unitLeaderReview
        ? {
            decision: unitLeaderReview.decision,
            decisionAt: unitLeaderReview.decision_at,
            remarks: unitLeaderReview.remarks,
            approver: unitLeaderReview.reviewer_id
              ? {
                  name: userMap[unitLeaderReview.reviewer_id]?.username || "N/A",
                  email: userMap[unitLeaderReview.reviewer_id]?.email || "N/A",
                  role: "Unit Leader",
                }
              : null,
          }
        : null,
      ppmuReview: ppmuReview
        ? {
            decision: ppmuReview.decision,
            decisionAt: ppmuReview.decision_at,
            remarks: ppmuReview.remarks,
            approver: ppmuReview.reviewer_id
              ? {
                  name: userMap[ppmuReview.reviewer_id]?.username || "N/A",
                  email: userMap[ppmuReview.reviewer_id]?.email || "N/A",
                  role: "PPMU Officer",
                }
              : null,
          }
        : null,
    };

    return NextResponse.json(response, { status: 200 });
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
          { error: "Only cancellation is allowed from this endpoint." },
          { status: 400 },
        );
      }
      updates.status = status;
    }

    if (booking_date || start_time || end_time) {
      return NextResponse.json(
        {
          error:
            "Rescheduling now creates a new booking request. Use the booking page to submit a new request.",
        },
        { status: 400 },
      );
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
