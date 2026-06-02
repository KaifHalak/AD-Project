import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
  verifyPicToken,
} from "@/lib/bookingTokenAuth";
import {
  formatDateInput,
  isBookingDateStringAllowed,
  isOfficeTimeRange,
  isWeekendDate,
  parseDateInput,
  toMinutes,
} from "@/lib/bookingConstraints";
import { findEquipmentTimetableConflict } from "@/lib/mockTimetable";

const MAX_RANGE_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getBookingDates(startDateString, endDateString) {
  const startDate = parseDateInput(startDateString);
  const endDate = parseDateInput(endDateString || startDateString);

  if (!startDate || !endDate || endDate < startDate) {
    return { error: "Please select a valid booking date range." };
  }

  const rangeDays = Math.floor((endDate - startDate) / MS_PER_DAY) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return { error: "Bookings can cover a maximum of 2 weeks." };
  }

  const dates = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    if (!isWeekendDate(cursor)) {
      const dateString = formatDateInput(cursor);

      if (!isBookingDateStringAllowed(dateString)) {
        return {
          error:
            "Bookings must be made at least 7 days in advance on weekdays.",
        };
      }

      dates.push(dateString);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (dates.length === 0) {
    return { error: "Please select at least one weekday for the booking." };
  }

  return { dates };
}
import { sendBookingSubmittedEmail } from "@/lib/bookingDecisionEmail";

export async function POST(request) {
  try {
    const accessToken = getAccessTokenFromHeader(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Please log in before booking equipment." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const equipmentId = body?.equipmentId;
    const bookingDate = body?.bookingDate;
    const bookingEndDate = body?.bookingEndDate || body?.endBookingDate;
    const startTime = body?.startTime;
    const endTime = body?.endTime;
    const picCode = body?.picCode?.trim()?.toUpperCase();
    const bookingReason = (body?.bookingReason || body?.usage || "").trim();
    const votNumber = String(body?.votNumber || body?.expenseVot || "").trim();
    const requesterIdentifier = String(body?.requesterIdentifier || "").trim();
    const requesterFaculty = String(body?.requesterFaculty || "").trim();
    const requesterContact = String(body?.requesterContact || "").trim();

    if (!equipmentId || !bookingDate || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required booking fields." },
        { status: 400 },
      );
    }

    const bookingDatesResult = getBookingDates(bookingDate, bookingEndDate);
    if (bookingDatesResult.error) {
      return NextResponse.json(
        { error: bookingDatesResult.error },
        { status: 400 },
      );
    }
    const bookingDates = bookingDatesResult.dates;

    if (!isOfficeTimeRange(startTime, endTime)) {
      return NextResponse.json(
        { error: "Bookings must be within office hours (08:00 to 18:00)." },
        { status: 400 },
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );
    }

    if (!votNumber) {
      return NextResponse.json(
        { error: "Please enter your VOT number." },
        { status: 400 },
      );
    }

    if (!requesterIdentifier || !requesterFaculty || !requesterContact) {
      return NextResponse.json(
        { error: "Please enter your ID, faculty, and contact number." },
        { status: 400 },
      );
    }

    const {
      requester,
      scopedClient,
      error: requesterError,
    } = await getRequesterProfile(
      accessToken,
      "Please log in before booking equipment.",
    );

    if (requesterError) {
      return NextResponse.json(
        { error: requesterError.message },
        { status: requesterError.status },
      );
    }

    const tokenVerification = await verifyPicToken({
      scopedClient,
      requester,
      picCode,
    });

    if (tokenVerification.error) {
      return NextResponse.json(
        { error: tokenVerification.error.message },
        { status: tokenVerification.error.status },
      );
    }

    for (const date of bookingDates) {
      const timetableConflict = findEquipmentTimetableConflict({
        equipmentId,
        date,
        startTime,
        endTime,
      });

      if (timetableConflict) {
        return NextResponse.json(
          {
            error: `${date} clashes with scheduled class: ${timetableConflict.title}.`,
          },
          { status: 409 },
        );
      }
    }

    const admin = getSupabaseAdminClient();
    const { data: equipment, error: equipmentError } = await admin
      .from("equipment")
      .select("id, name, status, price_per_hour")
      .eq("id", equipmentId)
      .maybeSingle();

    if (equipmentError || !equipment) {
      return NextResponse.json(
        { error: "Equipment not found." },
        { status: 404 },
      );
    }

    if (equipment.status === "maintenance") {
      return NextResponse.json(
        { error: "This equipment is under maintenance and cannot be booked." },
        { status: 409 },
      );
    }

    const durationHours = Math.max(
      0,
      (toMinutes(endTime) - toMinutes(startTime)) / 60,
    );
    const dailyPrice = Number(
      (durationHours * Number(equipment.price_per_hour || 0)).toFixed(2),
    );

    const { data: conflict, error: conflictError } = await admin
      .from("equipment_bookings")
      .select("id, booking_date")
      .eq("equipment_id", equipmentId)
      .in("booking_date", bookingDates)
      .lt("start_time", endTime)
      .gt("end_time", startTime)
      .in("status", ["pending", "approved"])
      .limit(1)
      .maybeSingle();

    if (conflictError) {
      console.error("Error checking equipment booking conflict:", conflictError);
      return NextResponse.json(
        { error: "Could not check equipment availability." },
        { status: 500 },
      );
    }

    if (conflict) {
      return NextResponse.json(
        {
          error: `${conflict.booking_date} is not available. Please select another date or time.`,
        },
        { status: 409 },
      );
    }

    const insertRows = bookingDates.map((date) => ({
      equipment_id: equipmentId,
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
      status: "pending",
      user_id: requester.id,
      booking_reason: bookingReason,
      grant_number: "",
      vot_number: votNumber,
      requester_identifier: requesterIdentifier,
      requester_faculty: requesterFaculty,
      requester_contact: requesterContact,
      total_price: dailyPrice,
    }));

    const { data: bookings, error: insertError } = await admin
      .from("equipment_bookings")
      .insert(insertRows)
      .select("*");

    if (insertError) {
      console.error("Error creating equipment booking:", insertError);
      return NextResponse.json(
        { error: "Booking failed. Please try again." },
        { status: 500 },
      );
    }

    const notification = await sendBookingSubmittedEmail({
      booking: {
        ...booking,
        booking_type: "equipment",
        item_id: equipmentId,
        item_name: equipment.name,
      },
      requester,
    });

    return NextResponse.json(
      {
       
        message:
          bookingDates.length === 1
            ? "Booking submitted. Waiting for approval."
            : `${bookingDates.length} bookings submitted. Waiting for approval.`,
        booking: bookings?.[0] || null,
        bookings:
        bookings || [],
     ,
        notification,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/equipment-bookings:", error);
    return NextResponse.json(
      { error: "Unexpected error while booking equipment." },
      { status: 500 },
    );
  }
}
