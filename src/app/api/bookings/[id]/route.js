import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";

function getAccessTokenFromHeader(request) {
  const authorizationHeader = request.headers.get("authorization") || "";
  if (!authorizationHeader.startsWith("Bearer ")) return "";
  return authorizationHeader.slice(7).trim();
}

async function resolveUserProfile(accessToken) {
  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);

  if (authError || !authData?.user?.email) {
    return { error: { status: 401, message: "Unauthorized. Please log in again." } };
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
      .select("*")
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

    return NextResponse.json({ booking }, { status: 200 });
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
    const body = await request.json();
    const { status } = body;

    const admin = getSupabaseAdminClient();

    const { data: existing, error: fetchError } = await admin
      .from("bookings")
      .select("id, user_id, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Booking not found." },
        { status: 404 },
      );
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

    const updates = { updated_at: new Date().toISOString() };

    if (status) {
      const allowedStatuses = ["cancelled", "pending", "approved"];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Invalid status value." },
          { status: 400 },
        );
      }
      updates.status = status;
    }

    const { booking_date, start_time, end_time } = body;
    if (booking_date) updates.booking_date = booking_date;
    if (start_time) updates.start_time = start_time;
    if (end_time) updates.end_time = end_time;

    const { data: updated, error: updateError } = await admin
      .from("bookings")
      .update(updates)
      .eq("id", id)
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
