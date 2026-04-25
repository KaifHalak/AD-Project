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

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type");

    const admin = getSupabaseAdminClient();
    let query = admin
      .from("bookings")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (typeFilter && typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    const { data: bookings, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching bookings:", fetchError);
      return NextResponse.json(
        { error: "Could not fetch bookings." },
        { status: 500 },
      );
    }

    return NextResponse.json({ bookings: bookings || [] }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/bookings:", error);
    return NextResponse.json(
      { error: "Something went wrong while fetching bookings." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
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

    const body = await request.json();
    const {
      type,
      resource_name,
      resource_subtitle,
      booking_date,
      start_time,
      end_time,
      image_url,
    } = body;

    if (!type || !resource_name || !booking_date || !start_time || !end_time) {
      return NextResponse.json(
        { error: "Missing required booking fields." },
        { status: 400 },
      );
    }

    if (!["lab", "equipment"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'lab' or 'equipment'." },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: booking, error: insertError } = await admin
      .from("bookings")
      .insert({
        user_id: profile.id,
        type,
        resource_name,
        resource_subtitle: resource_subtitle || null,
        booking_date,
        start_time,
        end_time,
        image_url: image_url || null,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .maybeSingle();

    if (insertError) {
      console.error("Error creating booking:", insertError);
      return NextResponse.json(
        { error: "Could not create booking." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Booking created successfully.", booking },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/bookings:", error);
    return NextResponse.json(
      { error: "Something went wrong while creating the booking." },
      { status: 500 },
    );
  }
}
