import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";

async function requirePpmuRequester(request) {
  const accessToken = getAccessTokenFromHeader(request);

  if (!accessToken) {
    return {
      error: { status: 401, message: "Please log in before viewing PPMU." },
    };
  }

  const { requester, error } = await getRequesterProfile(
    accessToken,
    "Please log in before viewing PPMU.",
  );

  if (error) return { error };

  if (requester.role !== "ppmu") {
    return {
      error: { status: 403, message: "Only PPMU users can access this page." },
    };
  }

  return { requester };
}

function getPpmuStatus(reviewableItems, processes) {
  if (!reviewableItems.length) return "Pending";
  const ppmuByItem = new Map(
    (processes || [])
      .filter((process) => process.reviewer_role === "ppmu")
      .map((process) => [Number(process.booking_id), process]),
  );
  const decisions = reviewableItems.map(
    (item) => ppmuByItem.get(item.id)?.decision || "pending",
  );

  if (decisions.every((decision) => decision === "approved")) return "Approved";
  if (decisions.every((decision) => decision === "rejected")) return "Rejected";
  if (decisions.some((decision) => decision !== "pending")) return "Partially Reviewed";
  return "Pending";
}

export async function GET(request) {
  try {
    const { error } = await requirePpmuRequester(request);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const admin = getSupabaseAdminClient();
    const { data: unitLeaderApprovals, error: unitLeaderError } = await admin
      .from("booking_process")
      .select("*")
      .eq("booking_type", "equipment")
      .eq("reviewer_role", "unit_leader")
      .eq("decision", "approved");

    if (unitLeaderError) {
      console.error("Error fetching unit leader recommendations:", unitLeaderError);
      return NextResponse.json(
        { error: "Could not fetch unit leader recommendations." },
        { status: 500 },
      );
    }

    const approvedItemIds = [
      ...new Set((unitLeaderApprovals || []).map((process) => Number(process.booking_id))),
    ];

    if (approvedItemIds.length === 0) {
      return NextResponse.json(
        { requests: [], stats: { total: 0, pending: 0, approved: 0, rejected: 0 } },
        { status: 200 },
      );
    }

    const { data: reviewableItems, error: itemsError } = await admin
      .from("equipment_bookings")
      .select("*")
      .in("id", approvedItemIds)
      .neq("status", "cancelled");

    if (itemsError) {
      console.error("Error fetching PPMU equipment items:", itemsError);
      return NextResponse.json(
        { error: "Could not fetch request items." },
        { status: 500 },
      );
    }

    const bookingIds = [
      ...new Set((reviewableItems || []).map((item) => item.booking_id).filter(Boolean)),
    ];
    const { data: bookings, error: bookingsError } = bookingIds.length
      ? await admin
          .from("bookings")
          .select("*")
          .in("id", bookingIds)
          .neq("overall_status", "cancelled")
      : { data: [], error: null };

    if (bookingsError) {
      console.error("Error fetching PPMU bookings:", bookingsError);
      return NextResponse.json(
        { error: "Could not fetch booking requests." },
        { status: 500 },
      );
    }

    const itemIds = (reviewableItems || []).map((item) => item.id);
    const { data: processes, error: processesError } = itemIds.length
      ? await admin
          .from("booking_process")
          .select("*")
          .eq("booking_type", "equipment")
          .in("booking_id", itemIds)
      : { data: [], error: null };

    if (processesError) {
      console.error("Error fetching PPMU process records:", processesError);
      return NextResponse.json(
        { error: "Could not fetch PPMU decisions." },
        { status: 500 },
      );
    }

    const requesterIds = [
      ...new Set((bookings || []).map((booking) => booking.user_id).filter(Boolean)),
    ];
    const { data: users, error: usersError } = requesterIds.length
      ? await admin.from("users").select("id, username, email, role").in("id", requesterIds)
      : { data: [], error: null };

    if (usersError) {
      console.error("Error fetching PPMU users:", usersError);
      return NextResponse.json(
        { error: "Could not fetch requester details." },
        { status: 500 },
      );
    }

    const usersById = new Map((users || []).map((user) => [user.id, user]));
    const itemsByBooking = new Map();

    for (const item of reviewableItems || []) {
      itemsByBooking.set(item.booking_id, [...(itemsByBooking.get(item.booking_id) || []), item]);
    }

    const requests = (bookings || []).map((booking) => {
      const requestItems = itemsByBooking.get(booking.id) || [];
      const requester = usersById.get(booking.user_id);
      const startDates = requestItems.map((item) => item.start_date).filter(Boolean).sort();

      return {
        id: booking.id,
        type: "request",
        user_name: requester?.username || "Unknown",
        booking_date: startDates[0] || booking.booking_date,
        item_count: requestItems.length,
        study_level: booking.study_level || "",
        lect_name: booking.lect_name || "",
        lect_email: booking.lect_email || "",
        lect_contact: booking.lect_contact || "",
        lect_faculty: booking.lect_faculty || "",
        lect_id: booking.lect_id || "",
        vot_number: booking.vot_number || "",
        total_price: booking.final_total_price ?? null,
        created_at: booking.created_at || null,
        overall_status: booking.overall_status,
        unit_leader_status: "Approved",
        ppmu_status: getPpmuStatus(requestItems, processes || []),
      };
    });

    const stats = {
      total: requests.length,
      pending: requests.filter((request) => request.ppmu_status === "Pending").length,
      approved: requests.filter((request) => request.ppmu_status === "Approved").length,
      rejected: requests.filter((request) => request.ppmu_status === "Rejected").length,
    };

    return NextResponse.json({ requests, stats }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/ppmu:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading PPMU requests." },
      { status: 500 },
    );
  }
}
