import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";

function getProcessKey(process) {
  return `${process.booking_type}-${process.booking_id}`;
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

  if (error) {
    return { error };
  }

  if (requester.role !== "ppmu") {
    return {
      error: { status: 403, message: "Only PPMU users can access this page." },
    };
  }

  return { requester };
}

export async function GET(request) {
  try {
    const { error } = await requirePpmuRequester(request);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const admin = getSupabaseAdminClient();

    const { data: unitLeaderProcesses, error: unitLeaderError } = await admin
      .from("booking_process")
      .select("*")
      .eq("reviewer_role", "unit_leader")
      .eq("decision", "approved")
      .order("decision_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (unitLeaderError) {
      console.error("Error fetching unit leader approvals:", unitLeaderError);
      return NextResponse.json(
        { error: "Could not fetch approved unit leader records." },
        { status: 500 },
      );
    }

    const latestUnitLeaderByBooking = getLatestByBooking(unitLeaderProcesses);
    const bookingIds = [...latestUnitLeaderByBooking.keys()];

    if (bookingIds.length === 0) {
      return NextResponse.json(
        {
          requests: [],
          stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
        },
        { status: 200 },
      );
    }

    const { data: bookings, error: bookingsError } = await admin
      .from("bookings")
      .select(
        "id, booking_type, item_id, user_id, booking_date, start_time, end_time, status, item_name",
      )
      .in("id", bookingIds);

    if (bookingsError) {
      console.error("Error fetching PPMU bookings view:", bookingsError);
      return NextResponse.json(
        { error: "Could not fetch booking details." },
        { status: 500 },
      );
    }

    const bookingsById = new Map((bookings || []).map((booking) => [booking.id, booking]));
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
      console.error("Error fetching PPMU requester users:", usersResult.error);
      return NextResponse.json(
        { error: "Could not fetch requester details." },
        { status: 500 },
      );
    }

    const usersById = new Map((usersResult.data || []).map((user) => [user.id, user]));
    const sourceIds = [
      ...new Set(
        [...latestUnitLeaderByBooking.values()]
          .map((process) => Number(process.booking_id))
          .filter(Number.isFinite),
      ),
    ];

    const ppmuProcessesResult = sourceIds.length
      ? await admin
          .from("booking_process")
          .select("*")
          .eq("reviewer_role", "ppmu")
          .in("booking_id", sourceIds)
      : { data: [], error: null };

    if (ppmuProcessesResult.error) {
      console.error("Error fetching PPMU process records:", ppmuProcessesResult.error);
      return NextResponse.json(
        { error: "Could not fetch PPMU decision records." },
        { status: 500 },
      );
    }

    const latestPpmuByBooking = getLatestByBooking(
      (ppmuProcessesResult.data || []).filter((process) =>
        latestUnitLeaderByBooking.has(getProcessKey(process)),
      ),
    );

    const requests = [...latestUnitLeaderByBooking.values()]
      .map((unitLeaderProcess) => {
        const key = getProcessKey(unitLeaderProcess);
        const booking = bookingsById.get(key);

        if (!booking) return null;

        const requester = usersById.get(booking.user_id);
        const ppmuProcess = latestPpmuByBooking.get(key);
        const ppmuStatus = toDisplayStatus(ppmuProcess?.decision);

        return {
          id: Number(unitLeaderProcess.booking_id),
          type: unitLeaderProcess.booking_type,
          user_name: requester?.username || "Unknown",
          booking_date: booking.booking_date,
          start_time: booking.start_time,
          end_time: booking.end_time,
          resource_name: booking.item_name || booking.item_id || "Unknown",
          unit_leader_status: "Approved",
          unit_leader_decision_at: unitLeaderProcess.decision_at,
          ppmu_status: ppmuStatus,
          ppmu_decision_at: ppmuProcess?.decision_at || null,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const rightTime = new Date(right.booking_date || 0).getTime();
        const leftTime = new Date(left.booking_date || 0).getTime();
        return rightTime - leftTime;
      });

    const stats = {
      total: requests.length,
      pending: requests.filter((requestItem) => requestItem.ppmu_status === "Pending")
        .length,
      approved: requests.filter((requestItem) => requestItem.ppmu_status === "Approved")
        .length,
      rejected: requests.filter((requestItem) => requestItem.ppmu_status === "Rejected")
        .length,
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
