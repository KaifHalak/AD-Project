import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";
import {
  OVERALL_STATUS,
  deriveOverallStatus,
  getDisplayStatus,
} from "@/lib/bookingRequest";

function getDateString(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function toMinutes(timeValue) {
  const [hours, minutes] = String(timeValue || "00:00")
    .slice(0, 5)
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function getWeekdayCount(startDateString, endDateString) {
  const startDate = new Date(`${startDateString}T00:00:00`);
  const endDate = new Date(`${endDateString || startDateString}T00:00:00`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 1;
  }

  let count = 0;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.max(1, count);
}

async function getPicDetailsForBooking(admin, booking) {
  if (!booking?.token || (booking.pic_name && booking.pic_email)) {
    return {
      picName: booking?.pic_name || "",
      picEmail: booking?.pic_email || "",
    };
  }

  const { data: tokenRow, error: tokenError } = await admin
    .from("pic_tokens")
    .select("assigned_by")
    .eq("token", booking.token)
    .eq("assigned_to", booking.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenError || !tokenRow?.assigned_by) {
    if (tokenError) {
      console.error("Error loading quotation PIC token:", tokenError);
    }

    return {
      picName: booking.pic_name || "",
      picEmail: booking.pic_email || "",
    };
  }

  const { data: picUser, error: picUserError } = await admin
    .from("users")
    .select("username, email, role")
    .eq("id", tokenRow.assigned_by)
    .maybeSingle();

  if (picUserError) {
    console.error("Error loading quotation PIC user:", picUserError);
  }

  return {
    picName: booking.pic_name || picUser?.username || "",
    picEmail: booking.pic_email || picUser?.email || "",
    picRole: picUser?.role || "pic",
  };
}

function getValueList(values) {
  const uniqueValues = [
    ...new Set((values || []).filter((value) => value !== null && value !== undefined && value !== "")),
  ];

  if (uniqueValues.length === 0) return "";
  if (uniqueValues.length === 1) return uniqueValues[0];
  return "Multiple";
}

function isProcessedStatus(status) {
  return status === OVERALL_STATUS.PROCESSED || getDisplayStatus(status) === "Processed";
}

function getBillableTotal(items) {
  return (items || []).reduce(
    (sum, item) =>
      sum + (item.resourceStatus === "rejected" ? 0 : Number(item.totalPrice || 0)),
    0,
  );
}

function buildQuotationPayload({
  booking,
  requesterProfile,
  items,
  equipmentById,
  labsById,
  quotationNumber,
  quotationDate,
  picDetails,
}) {
  const quotationItems = (items || []).map((item) => {
    const equipment = equipmentById.get(item.equipment_id);
    const lab = labsById.get(item.lab_id);
    const durationHours = Math.max(
      0,
      (toMinutes(item.end_time) - toMinutes(item.start_time)) / 60,
    );
    const bookingDayCount = getWeekdayCount(item.start_date, item.end_date);

    return {
      bookingType: "Equipment Booking",
      resourceName: equipment?.name || item.equipment_id,
      resourceId: item.equipment_id,
      resourceLocation: equipment?.location || lab?.location || "",
      resourceStatus: item.status || "",
      approvalStatus: item.status || "",
      resourceCourse: equipment?.course || lab?.course || "",
      resourceDescription: equipment?.description || "",
      resourceQuantity: equipment?.quantity ?? "",
      resourceLabId: item.lab_id || "",
      startDate: item.start_date,
      endDate: item.end_date || item.start_date,
      startTime: String(item.start_time || "").slice(0, 5),
      endTime: String(item.end_time || "").slice(0, 5),
      bookingDayCount,
      durationHours,
      pricePerHour: equipment?.price_per_hour ?? item.price_per_hour ?? 0,
      totalPrice: item.total_price || 0,
      purpose: item.booking_reason || booking.request_details || "",
    };
  });
  const staffNames = quotationItems.map((item) => {
    const equipment = equipmentById.get(item.resourceId);
    return equipment?.staff_name || "";
  });
  const staffEmails = quotationItems.map((item) => {
    const equipment = equipmentById.get(item.resourceId);
    return equipment?.staff_email || "";
  });
  const staffContacts = quotationItems.map((item) => {
    const equipment = equipmentById.get(item.resourceId);
    return equipment?.staff_contact || "";
  });
  const billableTotal = getBillableTotal(quotationItems);

  return {
    bookingType: "Equipment Booking",
    quotationNumber,
    quotationDate,
    resourceName:
      quotationItems.length === 1
        ? quotationItems[0]?.resourceName
        : `${quotationItems.length} equipment items`,
    resourceId: getValueList(quotationItems.map((item) => item.resourceId)),
    requester: {
      username: requesterProfile?.username || "",
      role: requesterProfile?.role || "",
      email: requesterProfile?.email || "",
    },
    requesterIdentifier: booking.requester_identifier || "",
    requesterFaculty: booking.requester_faculty || "",
    requesterContact: booking.requester_contact || "",
    studentStatus: booking.study_level || "",
    lecturerName: booking.lect_name || "",
    lecturerEmail: booking.lect_email || "",
    lecturerContact: booking.lect_contact || "",
    staffName: getValueList(staffNames),
    staffEmail: getValueList(staffEmails),
    staffContact: getValueList(staffContacts),
    pic: {
      username: picDetails.picName || "",
      role: picDetails.picRole || "pic",
      email: picDetails.picEmail || "",
    },
    picCode: booking.token || "",
    startDate: quotationItems[0]?.startDate || booking.booking_date || "",
    endDate: quotationItems[0]?.endDate || booking.booking_date || "",
    startTime: getValueList(quotationItems.map((item) => item.startTime)),
    endTime: getValueList(quotationItems.map((item) => item.endTime)),
    bookingDayCount: quotationItems.reduce(
      (sum, item) => sum + Number(item.bookingDayCount || 0),
      0,
    ),
    durationHours: "",
    pricePerHour: "",
    totalPrice: billableTotal,
    votNumber: booking.vot_number || "",
    purpose: booking.request_details || getValueList(quotationItems.map((item) => item.purpose)),
    resourceLocation: getValueList(quotationItems.map((item) => item.resourceLocation)),
    resourceStatus: "processed",
    resourceCourse: getValueList(quotationItems.map((item) => item.resourceCourse)),
    resourceDescription:
      quotationItems.length === 1 ? quotationItems[0]?.resourceDescription || "" : "",
    resourceQuantity:
      quotationItems.length === 1 ? quotationItems[0]?.resourceQuantity || "" : "",
    resourceLabId: getValueList(quotationItems.map((item) => item.resourceLabId)),
    items: quotationItems,
  };
}

export async function GET(request, { params }) {
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

    const { id } = await params;
    const bookingId = Number(id);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return NextResponse.json({ error: "Invalid booking ID." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.user_id !== requester.id && !["unit_leader", "ppmu"].includes(requester.role)) {
      return NextResponse.json(
        { error: "You do not have permission to view this booking." },
        { status: 403 },
      );
    }

    const { data: items, error: itemsError } = await admin
      .from("equipment_bookings")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    if (itemsError) {
      console.error("Error loading quotation booking items:", itemsError);
      return NextResponse.json(
        { error: "Could not load booking items." },
        { status: 500 },
      );
    }

    const overallStatus = booking.overall_status || deriveOverallStatus(items || []);
    if (!isProcessedStatus(overallStatus)) {
      return NextResponse.json(
        { error: "Quotation can only be downloaded for processed requests." },
        { status: 400 },
      );
    }

    const { data: existingQuotation, error: existingQuotationError } = await admin
      .from("booking_quotations")
      .select("*")
      .eq("booking_type", "equipment")
      .eq("primary_booking_id", bookingId)
      .maybeSingle();

    if (existingQuotationError) {
      console.error("Error loading existing quotation:", existingQuotationError);
      return NextResponse.json(
        { error: "Could not load quotation." },
        { status: 500 },
      );
    }

    if (existingQuotation) {
      return NextResponse.json(
        { quotation: existingQuotation, source: "existing" },
        { status: 200 },
      );
    }

    const equipmentIds = [...new Set((items || []).map((item) => item.equipment_id))];
    const labIds = [...new Set((items || []).map((item) => item.lab_id))];
    const [equipmentResult, labsResult, requesterResult] = await Promise.all([
      equipmentIds.length
        ? admin
            .from("equipment")
            .select(
              "id, name, description, course, location, lab_id, price_per_hour, quantity, staff_name, staff_email, staff_contact",
            )
            .in("id", equipmentIds)
        : Promise.resolve({ data: [], error: null }),
      labIds.length
        ? admin.from("labs").select("id, name, course, location").in("id", labIds)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("users")
        .select("id, username, email, role")
        .eq("id", booking.user_id)
        .maybeSingle(),
    ]);

    if (equipmentResult.error || labsResult.error || requesterResult.error) {
      console.error(
        "Error loading quotation supporting data:",
        equipmentResult.error || labsResult.error || requesterResult.error,
      );
      return NextResponse.json(
        { error: "Could not load quotation details." },
        { status: 500 },
      );
    }

    const quotationDate = getDateString();
    const quotationNumber = `Q-EQ-${bookingId}-${Date.now()}`;
    const picDetails = await getPicDetailsForBooking(admin, booking);
    const quotationPayload = buildQuotationPayload({
      booking,
      requesterProfile: requesterResult.data,
      items: items || [],
      equipmentById: new Map((equipmentResult.data || []).map((item) => [item.id, item])),
      labsById: new Map((labsResult.data || []).map((lab) => [lab.id, lab])),
      quotationNumber,
      quotationDate,
      picDetails,
    });

    const { data: createdQuotation, error: createError } = await admin
      .from("booking_quotations")
      .insert({
        quotation_number: quotationNumber,
        quotation_date: quotationDate,
        version: 1,
        booking_type: "equipment",
        primary_booking_id: bookingId,
        booking_ids: [bookingId],
        user_id: booking.user_id,
        quotation_payload: quotationPayload,
      })
      .select("*")
      .maybeSingle();

    if (createError) {
      console.error("Error creating quotation:", createError);
      return NextResponse.json(
        { error: "Could not create quotation." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { quotation: createdQuotation, source: "created" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in GET /api/bookings/[id]/quotation:", error);
    return NextResponse.json(
      { error: "Something went wrong while preparing the quotation." },
      { status: 500 },
    );
  }
}
