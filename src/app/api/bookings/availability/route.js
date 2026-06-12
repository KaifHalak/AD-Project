import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";
import {
  ACTIVE_EQUIPMENT_STATUSES,
  findTimetableConflictForItem,
  hasDateOverlap,
  validateBookingItem,
} from "@/lib/bookingRequest";
import { timeRangesOverlap } from "@/lib/bookingConstraints";

async function findLabConflict(admin, item, requesterId) {
  const { data: candidates, error } = await admin
    .from("equipment_bookings")
    .select("id, booking_id, lab_id, start_date, end_date, start_time, end_time, status")
    .eq("lab_id", item.labId)
    .in("status", ACTIVE_EQUIPMENT_STATUSES)
    .lte("start_date", item.endDate)
    .gte("end_date", item.startDate);

  if (error) {
    return { error };
  }

  if (!candidates?.length) {
    return { conflict: null };
  }

  const bookingIds = [...new Set(candidates.map((candidate) => candidate.booking_id))];
  const { data: parentBookings, error: parentError } = await admin
    .from("bookings")
    .select("id, user_id")
    .in("id", bookingIds);

  if (parentError) {
    return { error: parentError };
  }

  const parentById = new Map((parentBookings || []).map((booking) => [booking.id, booking]));
  const conflict = candidates.find((candidate) => {
    const parent = parentById.get(candidate.booking_id);
    if (parent?.user_id === requesterId) return false;

    return (
      hasDateOverlap(item.startDate, item.endDate, candidate.start_date, candidate.end_date) &&
      timeRangesOverlap(item.startTime, item.endTime, candidate.start_time, candidate.end_time)
    );
  });

  return { conflict: conflict || null };
}

export async function POST(request) {
  try {
    const accessToken = getAccessTokenFromHeader(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Please log in before checking availability." },
        { status: 401 },
      );
    }

    const { requester, error: requesterError } = await getRequesterProfile(
      accessToken,
      "Please log in before checking availability.",
    );

    if (requesterError) {
      return NextResponse.json(
        { error: requesterError.message },
        { status: requesterError.status },
      );
    }

    const body = await request.json();
    const validation = validateBookingItem(body);

    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: equipment, error: equipmentError } = await admin
      .from("equipment")
      .select("id, name, status, lab_id")
      .eq("id", validation.item.equipmentId)
      .maybeSingle();

    if (equipmentError || !equipment) {
      return NextResponse.json({ error: "Equipment not found." }, { status: 404 });
    }

    if (equipment.status === "maintenance") {
      return NextResponse.json(
        { error: "This equipment is under maintenance." },
        { status: 409 },
      );
    }

    if (equipment.status === "unavailable") {
      return NextResponse.json(
        { error: "This equipment is unavailable." },
        { status: 409 },
      );
    }

    const item = { ...validation.item, labId: equipment.lab_id };
    const timetableConflict = findTimetableConflictForItem(item);

    if (timetableConflict) {
      return NextResponse.json(
        {
          error: `${timetableConflict.date} clashes with scheduled class: ${timetableConflict.conflict.title}.`,
        },
        { status: 409 },
      );
    }

    const { conflict, error: conflictError } = await findLabConflict(
      admin,
      item,
      requester.id,
    );

    if (conflictError) {
      console.error("Error checking booking availability:", conflictError);
      return NextResponse.json(
        { error: "Could not check lab availability." },
        { status: 500 },
      );
    }

    if (conflict) {
      return NextResponse.json(
        { error: "This lab is not available for the selected date and time." },
        { status: 409 },
      );
    }

    return NextResponse.json({ available: true }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/bookings/availability:", error);
    return NextResponse.json(
      { error: "Something went wrong while checking availability." },
      { status: 500 },
    );
  }
}
