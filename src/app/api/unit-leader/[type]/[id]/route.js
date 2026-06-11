import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";
import { refreshParentStatus } from "@/lib/bookingRequest";

const ALLOWED_DECISIONS = new Set(["approved", "rejected"]);

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

function parseRouteParams(type, id) {
  const numericId = Number(id);

  if (type !== "request" || !Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  return { id: numericId };
}

async function getRequestDetail(admin, bookingId) {
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return { error: bookingError || new Error("Booking not found.") };
  }

  const { data: items, error: itemsError } = await admin
    .from("equipment_bookings")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (itemsError) return { error: itemsError };

  const equipmentIds = [...new Set((items || []).map((item) => item.equipment_id))];
  const labIds = [...new Set((items || []).map((item) => item.lab_id))];
  const itemIds = (items || []).map((item) => item.id);
  const [equipmentResult, labsResult, processesResult, usersResult] = await Promise.all([
    equipmentIds.length
      ? admin
          .from("equipment")
          .select("id, name, description, price_per_hour, staff_name, staff_email, staff_contact")
          .in("id", equipmentIds)
      : Promise.resolve({ data: [], error: null }),
    labIds.length
      ? admin.from("labs").select("id, name, location, course").in("id", labIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? admin
          .from("booking_process")
          .select("*")
          .eq("booking_type", "equipment")
          .in("booking_id", itemIds)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("users")
      .select("id, username, email, role")
      .eq("id", booking.user_id)
      .maybeSingle(),
  ]);

  const equipmentById = new Map((equipmentResult.data || []).map((item) => [item.id, item]));
  const labsById = new Map((labsResult.data || []).map((lab) => [lab.id, lab]));
  const processesByItem = new Map();

  for (const process of processesResult.data || []) {
    processesByItem.set(Number(process.booking_id), [
      ...(processesByItem.get(Number(process.booking_id)) || []),
      process,
    ]);
  }

  return {
    request: {
      ...booking,
      type: "request",
      user_name: usersResult.data?.username || "Unknown",
      user_email: usersResult.data?.email || "Unknown",
      user_role: usersResult.data?.role || "Unknown",
      items: (items || []).map((item) => {
        const equipment = equipmentById.get(item.equipment_id);
        const lab = labsById.get(item.lab_id);
        const processes = processesByItem.get(item.id) || [];
        const unitLeaderProcess = processes.find(
          (process) => process.reviewer_role === "unit_leader",
        );
        const ppmuProcess = processes.find((process) => process.reviewer_role === "ppmu");

        return {
          ...item,
          equipment_name: equipment?.name || item.equipment_id,
          equipment_description: equipment?.description || "",
          lab_name: lab?.name || item.lab_id,
          location: lab?.location || "",
          course: lab?.course || "",
          price_per_hour: equipment?.price_per_hour ?? null,
          staff_name: equipment?.staff_name || "",
          staff_email: equipment?.staff_email || "",
          staff_contact: equipment?.staff_contact || "",
          unit_leader_process: unitLeaderProcess || null,
          ppmu_process: ppmuProcess || null,
          can_review: !unitLeaderProcess && item.status !== "cancelled",
        };
      }),
    },
  };
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
    const { request: requestDetail, error } = await getRequestDetail(admin, parsed.id);

    if (error || !requestDetail) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    return NextResponse.json({ request: requestDetail }, { status: 200 });
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
    const itemId = Number(body?.itemId);
    const decision = String(body?.decision || "").trim().toLowerCase();
    const defaultRemarks =
      decision === "approved" ? "Approved by Unit Leader" : "Rejected by Unit Leader";
    const remarks = String(body?.remarks || "").trim() || defaultRemarks;

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Invalid equipment item." }, { status: 400 });
    }

    if (!ALLOWED_DECISIONS.has(decision)) {
      return NextResponse.json(
        { error: "Decision must be approved or rejected." },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: item, error: itemError } = await admin
      .from("equipment_bookings")
      .select("id, booking_id, status")
      .eq("id", itemId)
      .eq("booking_id", parsed.id)
      .maybeSingle();

    if (itemError || !item) {
      return NextResponse.json({ error: "Equipment item not found." }, { status: 404 });
    }

    const { data: existingProcess, error: existingProcessError } = await admin
      .from("booking_process")
      .select("id")
      .eq("booking_type", "equipment")
      .eq("booking_id", itemId)
      .eq("reviewer_role", "unit_leader")
      .maybeSingle();

    if (existingProcessError) {
      console.error("Error checking existing decision:", existingProcessError);
      return NextResponse.json(
        { error: "Could not verify existing decision." },
        { status: 500 },
      );
    }

    if (existingProcess) {
      return NextResponse.json(
        { error: "Unit leader decision has already been made for this item." },
        { status: 409 },
      );
    }

    const nextStatus = decision === "approved" ? "under_ppmu_review" : "rejected";
    const { data: processRecord, error: insertError } = await admin
      .from("booking_process")
      .insert({
        booking_type: "equipment",
        booking_id: itemId,
        reviewer_id: requester.id,
        reviewer_role: "unit_leader",
        decision,
        rejection_reason: decision === "rejected" ? remarks : null,
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

    const { error: statusError } = await admin
      .from("equipment_bookings")
      .update({ status: nextStatus })
      .eq("id", itemId);

    if (statusError) {
      console.error("Error updating equipment status:", statusError);
      return NextResponse.json(
        { error: "Decision saved, but item status could not be updated." },
        { status: 500 },
      );
    }

    await refreshParentStatus(admin, parsed.id);

    return NextResponse.json(
      {
        message:
          decision === "approved" ? "Equipment item approved." : "Equipment item rejected.",
        process: processRecord,
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

