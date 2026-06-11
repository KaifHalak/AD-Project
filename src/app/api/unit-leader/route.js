import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";

async function requireUnitLeaderRequester(request) {
  const accessToken = getAccessTokenFromHeader(request);

  if (!accessToken) {
    return {
      error: {
        status: 401,
        message: "Please log in before viewing unit leader approvals.",
      },
    };
  }

  const { requester, error } = await getRequesterProfile(
    accessToken,
    "Please log in before viewing unit leader approvals.",
  );

  if (error) return { error };

  if (requester.role !== "unit_leader") {
    return {
      error: { status: 403, message: "Only unit leaders can access this page." },
    };
  }

  return { requester };
}

function getUnitLeaderStatus(items, processes) {
  if (!items.length) return "Pending";
  const processByItem = new Map(
    (processes || [])
      .filter((process) => process.reviewer_role === "unit_leader")
      .map((process) => [Number(process.booking_id), process]),
  );
  const decisions = items.map((item) => processByItem.get(item.id)?.decision || "pending");

  if (decisions.every((decision) => decision === "approved")) return "Approved";
  if (decisions.every((decision) => decision === "rejected")) return "Rejected";
  if (decisions.some((decision) => decision !== "pending")) return "Partially Reviewed";
  return "Pending";
}

export async function GET(request) {
  try {
    const { error } = await requireUnitLeaderRequester(request);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const admin = getSupabaseAdminClient();
    const { data: bookings, error: bookingsError } = await admin
      .from("bookings")
      .select("*")
      .neq("overall_status", "cancelled")
      .order("created_at", { ascending: false });

    if (bookingsError) {
      console.error("Error fetching unit leader bookings:", bookingsError);
      return NextResponse.json(
        { error: "Could not fetch booking requests." },
        { status: 500 },
      );
    }

    const bookingIds = (bookings || []).map((booking) => booking.id);
    const { data: items, error: itemsError } = bookingIds.length
      ? await admin.from("equipment_bookings").select("*").in("booking_id", bookingIds)
      : { data: [], error: null };

    if (itemsError) {
      console.error("Error fetching unit leader equipment items:", itemsError);
      return NextResponse.json(
        { error: "Could not fetch request items." },
        { status: 500 },
      );
    }

    const itemIds = (items || []).map((item) => item.id);
    const { data: processes, error: processesError } = itemIds.length
      ? await admin
          .from("booking_process")
          .select("*")
          .eq("booking_type", "equipment")
          .in("booking_id", itemIds)
      : { data: [], error: null };

    if (processesError) {
      console.error("Error fetching unit leader process records:", processesError);
      return NextResponse.json(
        { error: "Could not fetch review decisions." },
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
      console.error("Error fetching requester users:", usersError);
      return NextResponse.json(
        { error: "Could not fetch requester details." },
        { status: 500 },
      );
    }

    const usersById = new Map((users || []).map((user) => [user.id, user]));
    const itemsByBooking = new Map();

    for (const item of items || []) {
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
        vot_number: booking.vot_number || "",
        total_price: booking.final_total_price ?? null,
        created_at: booking.created_at || null,
        overall_status: booking.overall_status,
        unit_leader_status: getUnitLeaderStatus(requestItems, processes || []),
      };
    });

    const stats = {
      total: requests.length,
      pending: requests.filter((request) => request.unit_leader_status === "Pending").length,
      approved: requests.filter((request) => request.unit_leader_status === "Approved").length,
      rejected: requests.filter((request) => request.unit_leader_status === "Rejected").length,
    };

    return NextResponse.json({ requests, stats }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/unit-leader:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading unit leader requests." },
      { status: 500 },
    );
  }
}
