import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";
import {
  getBookingProcessKey,
  parseBookingViewId,
} from "@/lib/bookingViewId";

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

function getProcessTime(process) {
  return new Date(process.decision_at || process.created_at || 0).getTime();
}

function getLatestProcessByRole(processes, reviewerRole) {
  const latestByBooking = new Map();

  for (const process of processes || []) {
    if (process.reviewer_role !== reviewerRole) continue;

    const key = getBookingProcessKey(process.booking_type, process.booking_id);
    const current = latestByBooking.get(key);

    if (!current || getProcessTime(process) > getProcessTime(current)) {
      latestByBooking.set(key, process);
    }
  }

  return latestByBooking;
}

function deriveBookingStatus(booking, unitLeaderProcess, ppmuProcess) {
  if (booking.status === "cancelled") {
    return {
      display_status: "Cancelled",
      display_status_type: "cancelled",
      rejection_reason: "",
      is_final_approved: false,
    };
  }

  if (!unitLeaderProcess) {
    return {
      display_status: "Pending Unit Leader Approval",
      display_status_type: "pending",
      rejection_reason: "",
      is_final_approved: false,
    };
  }

  if (unitLeaderProcess.decision === "rejected") {
    return {
      display_status: "Rejected by Unit Leader",
      display_status_type: "rejected",
      rejection_reason:
        unitLeaderProcess.rejection_reason || unitLeaderProcess.remarks || "",
      is_final_approved: false,
    };
  }

  if (!ppmuProcess) {
    return {
      display_status: "Approved by Unit Leader, Pending Approval by PPMU",
      display_status_type: "pending",
      rejection_reason: "",
      is_final_approved: false,
    };
  }

  if (ppmuProcess.decision === "rejected") {
    return {
      display_status: "Rejected by PPMU",
      display_status_type: "rejected",
      rejection_reason: ppmuProcess.rejection_reason || ppmuProcess.remarks || "",
      is_final_approved: false,
    };
  }

  return {
    display_status: "Approved",
    display_status_type: "approved",
    rejection_reason: "",
    is_final_approved: ppmuProcess.decision === "approved",
  };
}

async function applyProcessStatuses(admin, bookings) {
  const parsedBookings = (bookings || [])
    .map((booking) => ({ booking, parsed: parseBookingViewId(booking.id) }))
    .filter(({ parsed }) => parsed);

  if (parsedBookings.length === 0) {
    return bookings || [];
  }

  const bookingTypes = [
    ...new Set(parsedBookings.map(({ parsed }) => parsed.bookingType)),
  ];
  const sourceIds = [
    ...new Set(parsedBookings.map(({ parsed }) => parsed.sourceId)),
  ];

  const { data: processes, error } = await admin
    .from("booking_process")
    .select("*")
    .in("booking_type", bookingTypes)
    .in("booking_id", sourceIds);

  if (error) {
    console.error("Error fetching booking process records:", error);
    return (bookings || []).map((booking) => ({
      ...booking,
      source_status: booking.status,
      display_status: booking.status || "-",
      display_status_type: booking.status || "pending",
      rejection_reason: "",
      is_final_approved: booking.status === "approved",
    }));
  }

  const unitLeaderByBooking = getLatestProcessByRole(processes, "unit_leader");
  const ppmuByBooking = getLatestProcessByRole(processes, "ppmu");

  return (bookings || []).map((booking) => {
    const parsed = parseBookingViewId(booking.id);
    const key = parsed
      ? getBookingProcessKey(parsed.bookingType, parsed.sourceId)
      : "";
    const derived = deriveBookingStatus(
      booking,
      unitLeaderByBooking.get(key),
      ppmuByBooking.get(key),
    );

    return {
      ...booking,
      source_status: booking.status,
      ...derived,
    };
  });
}

function matchesStatusFilter(booking, statusFilter) {
  if (!statusFilter || statusFilter === "all") return true;
  return booking.display_status_type === statusFilter;
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
    const statusFilter = searchParams.get("status");

    const admin = getSupabaseAdminClient();
    let query = admin
      .from("bookings")
      .select("id, booking_type, item_id, user_id, booking_date, start_time, end_time, status, item_name")
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

    const processBookings = await applyProcessStatuses(admin, bookings || []);
    const filteredBookings = processBookings.filter((booking) =>
      matchesStatusFilter(booking, statusFilter),
    );
    const enrichedBookings = await enrichBookings(admin, filteredBookings);
    return NextResponse.json({ bookings: enrichedBookings }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/bookings:", error);
    return NextResponse.json(
      { error: "Something went wrong while fetching bookings." },
      { status: 500 },
    );
  }
}
