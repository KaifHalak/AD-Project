import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";
import { sendBookingDecisionEmail } from "@/lib/bookingDecisionEmail";

const ALLOWED_TYPES = new Set(["lab", "equipment"]);
const ALLOWED_DECISIONS = new Set(["approved", "rejected"]);

function getBookingViewId(type, id) {
  return `${type}-${id}`;
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

function parseRouteParams(type, id) {
  const numericId = Number(id);

  if (!ALLOWED_TYPES.has(type) || !Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  return { type, id: numericId };
}

async function getLatestUnitLeaderProcess(admin, type, id) {
  const { data, error } = await admin
    .from("booking_process")
    .select("*")
    .eq("booking_type", type)
    .eq("booking_id", id)
    .eq("reviewer_role", "unit_leader")
    .order("decision_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

function toDisplayStatus(decision) {
  if (decision === "approved") return "Approved";
  if (decision === "rejected") return "Rejected";
  return "Pending";
}

export async function GET(request, { params }) {
  try {
    const { type, id } = await params;
    const parsed = parseRouteParams(type, id);

    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid unit leader request." },
        { status: 400 },
      );
    }

    const { error: authError } = await requireUnitLeaderRequester(request);

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status },
      );
    }

    const admin = getSupabaseAdminClient();

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, booking_type, item_id, user_id, booking_date, start_time, end_time, status, item_name, grant_number, vot_number, total_price, created_at",
      )
      .eq("id", getBookingViewId(parsed.type, parsed.id))
      .maybeSingle();

    if (bookingError || !booking) {
      console.error("Error fetching unit leader booking detail:", bookingError);
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const { data: processData, error: processError } =
      await getLatestUnitLeaderProcess(admin, parsed.type, parsed.id);

    if (processError) {
      console.error("Error fetching unit leader process:", processError);
      return NextResponse.json(
        { error: "Could not fetch unit leader review." },
        { status: 500 },
      );
    }

    const userIds = [
      ...new Set([booking.user_id, processData?.reviewer_id].filter(Boolean)),
    ];

    const { data: users, error: usersError } = await admin
      .from("users")
      .select("id, username, email, role")
      .in("id", userIds);

    if (usersError) {
      console.error("Error fetching unit leader detail users:", usersError);
      return NextResponse.json(
        { error: "Could not fetch user details." },
        { status: 500 },
      );
    }

    const usersById = new Map((users || []).map((user) => [user.id, user]));
    const requester = usersById.get(booking.user_id);
    const unitLeader = usersById.get(processData?.reviewer_id);
    const displayStatus = toDisplayStatus(processData?.decision);
    const sourceTable =
      parsed.type === "lab" ? "lab_bookings" : "equipment_bookings";
    const { data: sourceBooking, error: sourceBookingError } = await admin
      .from(sourceTable)
      .select("booking_reason, requester_identifier, requester_faculty, requester_contact")
      .eq("id", parsed.id)
      .maybeSingle();

    if (sourceBookingError) {
      console.error("Error fetching booking reason:", sourceBookingError);
    }

    return NextResponse.json(
      {
        request: {
          id: parsed.id,
          type: parsed.type,
          booking_date: booking.booking_date,
          start_time: booking.start_time,
          end_time: booking.end_time,
          created_at: booking.created_at || null,
          status: displayStatus,
          status_type: processData?.decision || "pending",
          resource_name: booking.item_name || booking.item_id || "Unknown",
          grant_number: booking.grant_number || "",
          vot_number: booking.vot_number || "",
          total_price: booking.total_price ?? null,
          user_name: requester?.username || "Unknown",
          user_email: requester?.email || "Unknown",
          user_role: requester?.role || "Unknown",
          requester_identifier: sourceBooking?.requester_identifier || "",
          requester_faculty: sourceBooking?.requester_faculty || "",
          requester_contact: sourceBooking?.requester_contact || "",
          usage: sourceBooking?.booking_reason || "",
          unit_leader_name: unitLeader?.username || "N/A",
          unit_leader_email: unitLeader?.email || "N/A",
          unit_leader_role: unitLeader?.role || "N/A",
          unit_leader_decision: processData?.decision || "pending",
          unit_leader_date: processData?.decision_at || null,
          unit_leader_remarks: processData?.remarks || "",
          unit_leader_rejection_reason:
            processData?.rejection_reason || processData?.remarks || "",
          can_review: !processData,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/unit-leader/[type]/[id]:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading this unit leader request." },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { type, id } = await params;
    const parsed = parseRouteParams(type, id);

    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid unit leader request." },
        { status: 400 },
      );
    }

    const { requester, error: authError } = await requireUnitLeaderRequester(request);

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status },
      );
    }

    const body = await request.json();
    const decision = (body?.decision || "").trim().toLowerCase();
    const defaultRemarks =
      decision === "approved"
        ? "Approved by Unit Leader"
        : "Rejected by Unit Leader";
    const remarks = (body?.remarks || "").trim() || defaultRemarks;
    const rejectionReason = decision === "rejected" ? remarks : null;

    if (!ALLOWED_DECISIONS.has(decision)) {
      return NextResponse.json(
        { error: "Decision must be approved or rejected." },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id")
      .eq("id", getBookingViewId(parsed.type, parsed.id))
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const { data: existingProcess, error: existingProcessError } =
      await getLatestUnitLeaderProcess(admin, parsed.type, parsed.id);

    if (existingProcessError) {
      console.error(
        "Error checking existing unit leader decision:",
        existingProcessError,
      );
      return NextResponse.json(
        { error: "Could not verify existing unit leader decision." },
        { status: 500 },
      );
    }

    if (existingProcess) {
      return NextResponse.json(
        {
          error:
            "Unit leader decision has already been made and cannot be changed.",
        },
        { status: 409 },
      );
    }

    const { data: processRecord, error: insertError } = await admin
      .from("booking_process")
      .insert({
        booking_type: parsed.type,
        booking_id: parsed.id,
        reviewer_id: requester.id,
        reviewer_role: "unit_leader",
        decision,
        rejection_reason: rejectionReason,
        remarks,
      })
      .select("*")
      .maybeSingle();

    if (insertError) {
      console.error("Error inserting unit leader process record:", insertError);
      return NextResponse.json(
        { error: "Could not save the unit leader decision." },
        { status: 500 },
      );
    }

    const notification = await sendBookingDecisionEmail({
      admin,
      type: parsed.type,
      id: parsed.id,
      processRecord,
    });

    return NextResponse.json(
      {
        message:
          decision === "approved" ? "Booking approved." : "Booking rejected.",
        process: processRecord,
        notification,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/unit-leader/[type]/[id]:", error);
    return NextResponse.json(
      { error: "Something went wrong while saving the unit leader decision." },
      { status: 500 },
    );
  }
}
