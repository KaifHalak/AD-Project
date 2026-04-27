import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";

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

async function enrichBookings(admin, bookings) {
  const labIds = bookings
    .filter((booking) => booking.booking_type === "lab")
    .map((booking) => booking.item_id);
  const equipmentIds = bookings
    .filter((booking) => booking.booking_type === "equipment")
    .map((booking) => booking.item_id);

  const [labsResult, equipmentResult] = await Promise.all([
    labIds.length
      ? admin.from("labs").select("id, name, location, course").in("id", labIds)
      : Promise.resolve({ data: [], error: null }),
    equipmentIds.length
      ? admin
          .from("equipment")
          .select("id, name, location, course")
          .in("id", equipmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (labsResult.error) {
    console.error("Error enriching lab bookings:", labsResult.error);
  }

  if (equipmentResult.error) {
    console.error("Error enriching equipment bookings:", equipmentResult.error);
  }

  const labsById = new Map((labsResult.data || []).map((lab) => [lab.id, lab]));
  const equipmentById = new Map(
    (equipmentResult.data || []).map((equipment) => [equipment.id, equipment]),
  );

  return bookings.map((booking) => {
    const item =
      booking.booking_type === "lab"
        ? labsById.get(booking.item_id)
        : equipmentById.get(booking.item_id);
    const fallbackType = booking.booking_type === "lab" ? "Lab" : "Equipment";
    const subtitle = [item?.course, item?.location].filter(Boolean).join(" | ");

    return {
      ...booking,
      resource_name: item?.name || `${fallbackType} ${booking.item_id}`,
      resource_subtitle: subtitle || booking.item_id,
    };
  });
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
      .select("id, booking_type, item_id, user_id, booking_date, start_time, end_time, status")
      .eq("user_id", profile.id)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (typeFilter && typeFilter !== "all") {
      query = query.eq("booking_type", typeFilter);
    }

    const { data: bookings, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching bookings:", fetchError);
      return NextResponse.json(
        { error: "Could not fetch bookings." },
        { status: 500 },
      );
    }

    const enrichedBookings = await enrichBookings(admin, bookings || []);
    return NextResponse.json({ bookings: enrichedBookings }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/bookings:", error);
    return NextResponse.json(
      { error: "Something went wrong while fetching bookings." },
      { status: 500 },
    );
  }
}
