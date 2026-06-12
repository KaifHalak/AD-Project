import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
  verifyPicToken,
} from "@/lib/bookingTokenAuth";
import {
  sendBookingSubmittedEmail,
  sendBookingSubmittedPicEmail,
} from "@/lib/bookingDecisionEmail";
import {
  createBookingReceiptPdfBuffer,
} from "@/lib/bookingReceiptPdf";
import {
  ACTIVE_EQUIPMENT_STATUSES,
  OVERALL_STATUS,
  calculateItemTotal,
  deriveOverallStatus,
  findTimetableConflictForItem,
  getDisplayStatus,
  hasDateOverlap,
  validateBookingItem,
} from "@/lib/bookingRequest";
import { timeRangesOverlap } from "@/lib/bookingConstraints";

function groupBy(items, key) {
  const grouped = new Map();

  for (const item of items || []) {
    const groupKey = item[key];
    grouped.set(groupKey, [...(grouped.get(groupKey) || []), item]);
  }

  return grouped;
}

function getDateRange(items) {
  const startDates = (items || []).map((item) => item.start_date).filter(Boolean).sort();
  const endDates = (items || []).map((item) => item.end_date).filter(Boolean).sort();
  return {
    startDate: startDates[0] || null,
    endDate: endDates[endDates.length - 1] || null,
  };
}

function getTimeRange(items) {
  const startTimes = (items || []).map((item) => item.start_time).filter(Boolean).sort();
  const endTimes = (items || []).map((item) => item.end_time).filter(Boolean).sort();
  return {
    startTime: startTimes[0] || null,
    endTime: endTimes[endTimes.length - 1] || null,
  };
}

async function enrichParentBookings(admin, bookings) {
  const bookingIds = (bookings || []).map((booking) => booking.id);

  if (bookingIds.length === 0) {
    return [];
  }

  const { data: equipmentBookings, error } = await admin
    .from("equipment_bookings")
    .select("*")
    .in("booking_id", bookingIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading booking items:", error);
    return (bookings || []).map((booking) => ({
      ...booking,
      item_count: 0,
      items: [],
      display_status: getDisplayStatus(booking.overall_status),
      display_status_type:
        booking.overall_status || OVERALL_STATUS.PENDING_UNIT_LEADER_PROCESS,
    }));
  }

  const equipmentIds = [
    ...new Set((equipmentBookings || []).map((item) => item.equipment_id).filter(Boolean)),
  ];
  const labIds = [
    ...new Set((equipmentBookings || []).map((item) => item.lab_id).filter(Boolean)),
  ];

  const [equipmentResult, labsResult] = await Promise.all([
    equipmentIds.length
      ? admin
          .from("equipment")
          .select("id, name, description, course, location, lab_id, price_per_hour, staff_name, staff_email, staff_contact")
          .in("id", equipmentIds)
      : Promise.resolve({ data: [], error: null }),
    labIds.length
      ? admin.from("labs").select("id, name, course, location").in("id", labIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (equipmentResult.error) {
    console.error("Error enriching booking equipment:", equipmentResult.error);
  }

  if (labsResult.error) {
    console.error("Error enriching booking labs:", labsResult.error);
  }

  const equipmentById = new Map((equipmentResult.data || []).map((item) => [item.id, item]));
  const labsById = new Map((labsResult.data || []).map((lab) => [lab.id, lab]));
  const itemsByBooking = groupBy(equipmentBookings || [], "booking_id");

  return (bookings || []).map((booking) => {
    const items = (itemsByBooking.get(booking.id) || []).map((item) => {
      const equipment = equipmentById.get(item.equipment_id);
      const lab = labsById.get(item.lab_id);

      return {
        ...item,
        equipment_name: equipment?.name || item.equipment_id,
        equipment_description: equipment?.description || "",
        lab_name: lab?.name || item.lab_id,
        course: equipment?.course || lab?.course || "",
        location: equipment?.location || lab?.location || "",
        staff_name: equipment?.staff_name || "",
        staff_email: equipment?.staff_email || "",
        staff_contact: equipment?.staff_contact || "",
        price_per_hour: equipment?.price_per_hour ?? null,
      };
    });
    const dates = getDateRange(items);
    const times = getTimeRange(items);
    const status = booking.overall_status || deriveOverallStatus(items);

    return {
      ...booking,
      item_count: items.length,
      items,
      start_date: dates.startDate,
      end_date: dates.endDate,
      start_time: times.startTime,
      end_time: times.endTime,
      resource_name:
        items.length === 1
          ? items[0].equipment_name
          : `${items.length} equipment items`,
      resource_subtitle:
        items.length === 1 ? items[0].lab_name : "Multiple equipment request",
      total_price: booking.final_total_price,
      display_status: getDisplayStatus(status),
      display_status_type: status,
      source_status: status,
    };
  });
}

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

export async function GET(request) {
  try {
    const accessToken = getAccessTokenFromHeader(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Missing access token." },
        { status: 401 },
      );
    }

    const { requester, error: requesterError } = await getRequesterProfile(
      accessToken,
      "Unauthorized. Please log in again.",
    );

    if (requesterError) {
      return NextResponse.json(
        { error: requesterError.message },
        { status: requesterError.status },
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const admin = getSupabaseAdminClient();
    let query = admin
      .from("bookings")
      .select("*")
      .eq("user_id", requester.id)
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("overall_status", statusFilter);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error("Error fetching bookings:", error);
      return NextResponse.json(
        { error: "Could not fetch bookings." },
        { status: 500 },
      );
    }

    const enrichedBookings = await enrichParentBookings(admin, bookings || []);
    return NextResponse.json({ bookings: enrichedBookings }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/bookings:", error);
    return NextResponse.json(
      { error: "Something went wrong while fetching bookings." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const accessToken = getAccessTokenFromHeader(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Please log in before submitting a booking." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    const requesterIdentifier = String(body?.requesterIdentifier || "").trim();
    const requesterFaculty = String(body?.requesterFaculty || "").trim();
    const requesterContact = String(body?.requesterContact || "").trim();
    const studyLevel = String(body?.studyLevel || body?.study_level || "").trim();
    const lectName = String(body?.lectName || body?.lect_name || "").trim();
    const lectEmail = String(body?.lectEmail || body?.lect_email || "").trim();
    const lectContact = String(body?.lectContact || body?.lect_contact || "").trim();
    const lectFaculty = String(body?.lectFaculty || body?.lect_faculty || "").trim();
    const lectId = String(body?.lectId || body?.lect_id || "").trim();
    const votNumber = String(body?.votNumber || "").trim();
    const requestDetails = String(body?.requestDetails || "").trim();
    const picCode = String(body?.picCode || "").trim().toUpperCase();
    const allowedStudyLevels = new Set([
      "UTM STUDENT(UNDERGRADUATE)",
      "UTM STUDENT(POSTGRADUATE)",
      "UTM STAFF",
      "IPTA/IPTS STUDENT",
      "INDUSTRY",
      "INTERN",
      "FINAL YEAR PROJECT (FYP)",
    ]);

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Please add at least one equipment item to the request." },
        { status: 400 },
      );
    }

    if (!requesterIdentifier || !requesterFaculty || !requesterContact) {
      return NextResponse.json(
        { error: "Please enter your ID, faculty, and contact number." },
        { status: 400 },
      );
    }

    if (!allowedStudyLevels.has(studyLevel)) {
      return NextResponse.json(
        { error: "Please select a valid study level." },
        { status: 400 },
      );
    }

    if (!lectName || !lectEmail || !lectContact || !lectFaculty || !lectId) {
      return NextResponse.json(
        { error: "Please enter lecturer name, email, contact number, faculty, and ID number." },
        { status: 400 },
      );
    }

    if (!votNumber) {
      return NextResponse.json(
        { error: "Please enter your VOT number." },
        { status: 400 },
      );
    }

    const { requester, scopedClient, error: requesterError } =
      await getRequesterProfile(accessToken, "Please log in before submitting a booking.");

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

    const normalizedItems = [];
    for (const item of items) {
      const validation = validateBookingItem(item);

      if (validation.error) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      normalizedItems.push(validation.item);
    }

    const admin = getSupabaseAdminClient();
    const equipmentIds = [...new Set(normalizedItems.map((item) => item.equipmentId))];
    const { data: equipmentRows, error: equipmentError } = await admin
      .from("equipment")
      .select("id, name, status, lab_id, price_per_hour, staff_name, staff_email, staff_contact")
      .in("id", equipmentIds);

    if (equipmentError) {
      console.error("Error fetching equipment:", equipmentError);
      return NextResponse.json(
        { error: "Could not load equipment details." },
        { status: 500 },
      );
    }

    const equipmentById = new Map((equipmentRows || []).map((item) => [item.id, item]));
    const preparedItems = [];

    for (const item of normalizedItems) {
      const equipment = equipmentById.get(item.equipmentId);

      if (!equipment) {
        return NextResponse.json(
          { error: `Equipment ${item.equipmentId} was not found.` },
          { status: 404 },
        );
      }

      if (equipment.status === "maintenance") {
        return NextResponse.json(
          { error: `${equipment.name || equipment.id} is under maintenance.` },
          { status: 409 },
        );
      }

      if (equipment.status === "unavailable") {
        return NextResponse.json(
          { error: `${equipment.name || equipment.id} is unavailable.` },
          { status: 409 },
        );
      }

      const preparedItem = {
        ...item,
        labId: equipment.lab_id,
        equipmentName: equipment.name,
        totalPrice: calculateItemTotal({
          pricePerHour: equipment.price_per_hour,
          startTime: item.startTime,
          endTime: item.endTime,
          dayCount: item.bookingDates.length,
        }),
      };
      const timetableConflict = findTimetableConflictForItem(preparedItem);

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
        preparedItem,
        requester.id,
      );

      if (conflictError) {
        console.error("Error checking final availability:", conflictError);
        return NextResponse.json(
          { error: "Could not check lab availability." },
          { status: 500 },
        );
      }

      if (conflict) {
        return NextResponse.json(
          {
            error: `${equipment.name || equipment.id} is no longer available for the selected date and time.`,
          },
          { status: 409 },
        );
      }

      preparedItems.push(preparedItem);
    }

    const finalTotalPrice = preparedItems.reduce(
      (sum, item) => sum + Number(item.totalPrice || 0),
      0,
    );
    const firstDate = [...preparedItems.map((item) => item.startDate)].sort()[0] || null;
    const { data: parentBooking, error: parentError } = await admin
      .from("bookings")
      .insert({
        user_id: requester.id,
        booking_date: firstDate,
        requester_contact: requesterContact,
        requester_faculty: requesterFaculty,
        requester_identifier: requesterIdentifier,
        study_level: studyLevel,
        lect_name: lectName,
        lect_email: lectEmail,
        lect_contact: lectContact,
        lect_faculty: lectFaculty,
        lect_id: lectId,
        vot_number: votNumber,
        final_total_price: Number(finalTotalPrice.toFixed(2)),
        request_details: requestDetails,
        token: requester.role === "pic" ? null : picCode,
        pic_name: tokenVerification.pic?.name || null,
        pic_email: tokenVerification.pic?.email || null,
        overall_status: OVERALL_STATUS.PENDING_UNIT_LEADER_PROCESS,
      })
      .select("*")
      .maybeSingle();

    if (parentError || !parentBooking) {
      console.error("Error creating parent booking:", parentError);
      return NextResponse.json(
        { error: "Booking failed. Please try again." },
        { status: 500 },
      );
    }

    const insertRows = preparedItems.map((item) => ({
      booking_id: parentBooking.id,
      equipment_id: item.equipmentId,
      lab_id: item.labId,
      start_date: item.startDate,
      end_date: item.endDate,
      start_time: item.startTime,
      end_time: item.endTime,
      booking_reason: item.bookingReason,
      status: "pending",
      total_price: item.totalPrice,
    }));

    const { data: equipmentBookings, error: insertError } = await admin
      .from("equipment_bookings")
      .insert(insertRows)
      .select("*");

    if (insertError) {
      console.error("Error creating equipment bookings:", insertError);
      await admin.from("bookings").delete().eq("id", parentBooking.id);
      return NextResponse.json(
        { error: "Booking failed. Please try again." },
        { status: 500 },
      );
    }

    const receiptBooking = {
      ...parentBooking,
      user_name: requester.username || "",
      user_email: requester.email || "",
      user_role: requester.role || "",
      total_price: parentBooking.final_total_price,
      pic_token: parentBooking.token || "",
      items: (equipmentBookings || []).map((item) => {
        const equipment = equipmentById.get(item.equipment_id);

        return {
          ...item,
          equipment_name: equipment?.name || item.equipment_id,
          lab_name: item.lab_id,
          staff_name: equipment?.staff_name || "",
          staff_email: equipment?.staff_email || "",
          staff_contact: equipment?.staff_contact || "",
        };
      }),
    };
    let submittedEmailAttachments = [];

    try {
      submittedEmailAttachments = [
        {
          filename: `booking-request-receipt-${parentBooking.id}.pdf`,
          content: createBookingReceiptPdfBuffer(receiptBooking),
          contentType: "application/pdf",
        },
      ];
    } catch (receiptError) {
      console.error("Error generating booking receipt PDF attachment:", receiptError);
    }

    const notificationBooking = {
      ...parentBooking,
      booking_type: "equipment",
      item_id: parentBooking.id,
      item_name:
        preparedItems.length === 1
          ? preparedItems[0].equipmentName
          : `${preparedItems.length} equipment items`,
      booking_date: firstDate,
      start_time: preparedItems[0]?.startTime || "",
      end_time: preparedItems[0]?.endTime || "",
      user_name: requester.username || "",
      user_email: requester.email || "",
    };
    const notification = await sendBookingSubmittedEmail({
      booking: notificationBooking,
      requester,
      attachments: submittedEmailAttachments,
    });
    const picNotification =
      requester.role === "pic"
        ? { sent: false, skipped: true, reason: "Requester is the PIC." }
        : await sendBookingSubmittedPicEmail({
            booking: notificationBooking,
            requester,
            pic: tokenVerification.pic,
          });

    return NextResponse.json(
      {
        message: "Booking request submitted. Waiting for approval.",
        booking: parentBooking,
        equipmentBookings: equipmentBookings || [],
        notification,
        picNotification,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/bookings:", error);
    return NextResponse.json(
      { error: "Unexpected error while submitting the booking." },
      { status: 500 },
    );
  }
}
