import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";

function getProcessKey(process) {
  return `${process.booking_type}-${process.booking_id}`;
}

function getBookingSourceId(booking) {
  const [, sourceId] = String(booking.id || "").split("-");
  return Number(sourceId);
}

function getProcessTime(process) {
  return new Date(process.decision_at || process.created_at || 0).getTime();
}

function getLatestByBooking(processes) {
  const latestByBooking = new Map();

  for (const process of processes || []) {
    const key = getProcessKey(process);
    const current = latestByBooking.get(key);

    if (!current || getProcessTime(process) > getProcessTime(current)) {
      latestByBooking.set(key, process);
    }
  }

  return latestByBooking;
}

function toDisplayStatus(decision) {
  if (decision === "approved") return "Approved";
  if (decision === "rejected") return "Rejected";
  return "Pending";
}

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

  if (error) {
    return { error };
  }

  if (requester.role !== "unit_leader") {
    return {
      error: {
        status: 403,
        message: "Only unit leaders can access this page.",
      },
    };
  }

  return { requester };
}

export async function GET(request) {
  try {
    const { error } = await requireUnitLeaderRequester(request);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const admin = getSupabaseAdminClient();

    const { data: unitLeaderProcesses, error: processError } = await admin
      .from("booking_process")
      .select("*")
      .eq("reviewer_role", "unit_leader")
      .order("decision_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (processError) {
      console.error("Error fetching unit leader process records:", processError);
      return NextResponse.json(
        { error: "Could not fetch unit leader decision records." },
        { status: 500 },
      );
    }

    const latestUnitLeaderByBooking = getLatestByBooking(unitLeaderProcesses);

    const { data: bookings, error: bookingsError } = await admin
      .from("bookings")
      .select(
        "id, booking_type, item_id, user_id, booking_date, start_time, end_time, status, item_name, grant_number, vot_number, total_price, created_at",
      );

    if (bookingsError) {
      console.error("Error fetching unit leader bookings view:", bookingsError);
      return NextResponse.json(
        { error: "Could not fetch booking details." },
        { status: 500 },
      );
    }

    const requesterIds = [
      ...new Set((bookings || []).map((booking) => booking.user_id).filter(Boolean)),
    ];

    const usersResult = requesterIds.length
      ? await admin
          .from("users")
          .select("id, username, email, role")
          .in("id", requesterIds)
      : { data: [], error: null };

    if (usersResult.error) {
      console.error("Error fetching unit leader requester users:", usersResult.error);
      return NextResponse.json(
        { error: "Could not fetch requester details." },
        { status: 500 },
      );
    }

    const usersById = new Map((usersResult.data || []).map((user) => [user.id, user]));
    const statusRank = {
      Pending: 0,
      Approved: 1,
      Rejected: 2,
    };

    const requests = (bookings || [])
      .map((booking) => {
        const sourceId = getBookingSourceId(booking);
        const key = `${booking.booking_type}-${sourceId}`;
        const requester = usersById.get(booking.user_id);
        const unitLeaderProcess = latestUnitLeaderByBooking.get(key);
        const unitLeaderStatus = toDisplayStatus(unitLeaderProcess?.decision);

        return {
          id: sourceId,
          type: booking.booking_type,
          user_name: requester?.username || "Unknown",
          booking_date: booking.booking_date,
          start_time: booking.start_time,
          end_time: booking.end_time,
          resource_name: booking.item_name || booking.item_id || "Unknown",
          grant_number: booking.grant_number || "",
          vot_number: booking.vot_number || "",
          total_price: booking.total_price ?? null,
          created_at: booking.created_at || null,
          unit_leader_status: unitLeaderStatus,
          unit_leader_decision_at: unitLeaderProcess?.decision_at || null,
        };
      })
      .filter((requestItem) => Number.isFinite(requestItem.id))
      .sort((left, right) => {
        const rankDiff =
          statusRank[left.unit_leader_status] - statusRank[right.unit_leader_status];

        if (rankDiff !== 0) return rankDiff;

        const rightDate = new Date(right.booking_date || 0).getTime();
        const leftDate = new Date(left.booking_date || 0).getTime();

        return rightDate - leftDate;
      });

    const stats = {
      total: requests.length,
      pending: requests.filter(
        (requestItem) => requestItem.unit_leader_status === "Pending",
      ).length,
      approved: requests.filter(
        (requestItem) => requestItem.unit_leader_status === "Approved",
      ).length,
      rejected: requests.filter(
        (requestItem) => requestItem.unit_leader_status === "Rejected",
      ).length,
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
