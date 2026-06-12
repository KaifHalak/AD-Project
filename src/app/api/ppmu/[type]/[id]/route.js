import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";
import {
  sendPpmuDecisionRecipientEmail,
} from "@/lib/bookingDecisionEmail";
import { createQuotationPdfBuffer } from "@/lib/quotationPdf";
import {
  OVERALL_STATUS,
  getDisplayStatus,
  refreshParentStatus,
} from "@/lib/bookingRequest";

const ALLOWED_DECISIONS = new Set(["approved", "rejected"]);

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

function getValueList(values) {
  const uniqueValues = [
    ...new Set(
      (values || []).filter(
        (value) => value !== null && value !== undefined && value !== "",
      ),
    ),
  ];

  if (uniqueValues.length === 0) return "";
  if (uniqueValues.length === 1) return uniqueValues[0];
  return "Multiple";
}

function getBillableTotal(items) {
  return (items || []).reduce(
    (sum, item) =>
      sum + (item.resourceStatus === "rejected" ? 0 : Number(item.totalPrice || 0)),
    0,
  );
}

function getUniqueRecipients(recipients) {
  const seen = new Set();

  return (recipients || []).filter((recipient) => {
    const email = String(recipient?.email || "").trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
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

  if (error) return { error };

  if (requester.role !== "ppmu") {
    return {
      error: { status: 403, message: "Only PPMU users can access this page." },
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

  if (tokenError) {
    console.error("Error loading request PIC token:", tokenError);
    return {
      picName: booking.pic_name || "",
      picEmail: booking.pic_email || "",
    };
  }

  if (!tokenRow?.assigned_by) {
    return {
      picName: booking.pic_name || "",
      picEmail: booking.pic_email || "",
    };
  }

  const { data: picUser, error: picUserError } = await admin
    .from("users")
    .select("username, email")
    .eq("id", tokenRow.assigned_by)
    .maybeSingle();

  if (picUserError) {
    console.error("Error loading request PIC user:", picUserError);
  }

  return {
    picName: booking.pic_name || picUser?.username || "",
    picEmail: booking.pic_email || picUser?.email || "",
  };
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
  const unitLeaderReviewerIds = [
    ...new Set(
      (processesResult.data || [])
        .filter((process) => process.reviewer_role === "unit_leader")
        .map((process) => process.reviewer_id)
        .filter(Boolean),
    ),
  ];
  const { data: unitLeaderUsers, error: unitLeaderUsersError } =
    unitLeaderReviewerIds.length
      ? await admin
          .from("users")
          .select("id, username, email")
          .in("id", unitLeaderReviewerIds)
      : { data: [], error: null };
  const unitLeaderUsersById = new Map(
    (unitLeaderUsers || []).map((user) => [user.id, user]),
  );
  const { picName, picEmail } = await getPicDetailsForBooking(admin, booking);

  if (unitLeaderUsersError) {
    console.error("Error loading unit leader users:", unitLeaderUsersError);
  }

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
      display_status: getDisplayStatus(booking.overall_status),
      display_status_type:
        booking.overall_status || OVERALL_STATUS.PENDING_UNIT_LEADER_PROCESS,
      user_name: usersResult.data?.username || "Unknown",
      user_email: usersResult.data?.email || "Unknown",
      user_role: usersResult.data?.role || "Unknown",
      pic_token: booking.token || "",
      pic_name: picName,
      pic_email: picEmail,
      item_count: (items || []).length,
      total_price: booking.final_total_price,
      items: (items || []).map((item) => {
        const equipment = equipmentById.get(item.equipment_id);
        const lab = labsById.get(item.lab_id);
        const processes = processesByItem.get(item.id) || [];
        const unitLeaderProcess = processes.find(
          (process) => process.reviewer_role === "unit_leader",
        );
        const unitLeaderUser = unitLeaderUsersById.get(unitLeaderProcess?.reviewer_id);
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
          unit_leader_name: unitLeaderUser?.username || "",
          unit_leader_email: unitLeaderUser?.email || "",
          unit_leader_process: unitLeaderProcess || null,
          ppmu_process: ppmuProcess || null,
          can_review:
            unitLeaderProcess?.decision === "approved" &&
            !ppmuProcess &&
            item.status !== "cancelled",
        };
      }),
    },
  };
}

function buildQuotationPayloadFromRequest(requestDetail) {
  const quotationItems = (requestDetail.items || []).map((item) => {
    const durationHours = Math.max(
      0,
      (toMinutes(item.end_time) - toMinutes(item.start_time)) / 60,
    );
    const bookingDayCount = getWeekdayCount(item.start_date, item.end_date);

    return {
      bookingType: "Equipment Booking",
      resourceName: item.equipment_name || item.equipment_id,
      resourceId: item.equipment_id,
      resourceLocation: item.location || "",
      resourceStatus: item.status || "",
      approvalStatus: item.status || "",
      resourceCourse: item.course || "",
      resourceDescription: item.equipment_description || "",
      resourceQuantity: "",
      resourceLabId: item.lab_id || "",
      startDate: item.start_date,
      endDate: item.end_date || item.start_date,
      startTime: String(item.start_time || "").slice(0, 5),
      endTime: String(item.end_time || "").slice(0, 5),
      bookingDayCount,
      durationHours,
      pricePerHour: item.price_per_hour ?? 0,
      totalPrice: item.total_price || 0,
      purpose: item.booking_reason || requestDetail.request_details || "",
    };
  });
  const billableTotal = getBillableTotal(quotationItems);

  return {
    bookingType: "Equipment Booking",
    quotationNumber: `Q-EQ-${requestDetail.id}-${Date.now()}`,
    quotationDate: getDateString(),
    resourceName:
      quotationItems.length === 1
        ? quotationItems[0]?.resourceName
        : `${quotationItems.length} equipment items`,
    resourceId: getValueList(quotationItems.map((item) => item.resourceId)),
    requester: {
      username: requestDetail.user_name || "",
      role: requestDetail.user_role || "",
      email: requestDetail.user_email || "",
    },
    requesterIdentifier: requestDetail.requester_identifier || "",
    requesterFaculty: requestDetail.requester_faculty || "",
    requesterContact: requestDetail.requester_contact || "",
    studentStatus: requestDetail.study_level || "",
    lecturerName: requestDetail.lect_name || "",
    lecturerEmail: requestDetail.lect_email || "",
    lecturerContact: requestDetail.lect_contact || "",
    lecturerFaculty: requestDetail.lect_faculty || "",
    lecturerId: requestDetail.lect_id || "",
    staffName: getValueList(quotationItems.map((item) => {
      const source = (requestDetail.items || []).find(
        (bookingItem) => bookingItem.equipment_id === item.resourceId,
      );
      return source?.staff_name || "";
    })),
    staffEmail: getValueList((requestDetail.items || []).map((item) => item.staff_email)),
    staffContact: getValueList((requestDetail.items || []).map((item) => item.staff_contact)),
    pic: {
      username: requestDetail.pic_name || "",
      role: "pic",
      email: requestDetail.pic_email || "",
    },
    picCode: requestDetail.token || requestDetail.pic_token || "",
    startDate: quotationItems[0]?.startDate || requestDetail.booking_date || "",
    endDate: quotationItems[0]?.endDate || requestDetail.booking_date || "",
    startTime: getValueList(quotationItems.map((item) => item.startTime)),
    endTime: getValueList(quotationItems.map((item) => item.endTime)),
    bookingDayCount: quotationItems.reduce(
      (sum, item) => sum + Number(item.bookingDayCount || 0),
      0,
    ),
    durationHours: "",
    pricePerHour: "",
    totalPrice: billableTotal,
    votNumber: requestDetail.vot_number || "",
    purpose:
      requestDetail.request_details ||
      getValueList(quotationItems.map((item) => item.purpose)),
    resourceLocation: getValueList(quotationItems.map((item) => item.resourceLocation)),
    resourceStatus: "processed",
    resourceCourse: getValueList(quotationItems.map((item) => item.resourceCourse)),
    resourceDescription:
      quotationItems.length === 1 ? quotationItems[0]?.resourceDescription || "" : "",
    resourceQuantity: "",
    resourceLabId: getValueList(quotationItems.map((item) => item.resourceLabId)),
    items: quotationItems,
  };
}

async function getOrCreateQuotationForRequest(admin, requestDetail) {
  const { data: existingQuotation, error: existingError } = await admin
    .from("booking_quotations")
    .select("*")
    .eq("booking_type", "equipment")
    .eq("primary_booking_id", requestDetail.id)
    .maybeSingle();

  if (existingError) {
    console.error("Error loading PPMU approval quotation:", existingError);
    return { error: existingError };
  }

  if (existingQuotation) {
    return { quotation: existingQuotation };
  }

  const quotationPayload = buildQuotationPayloadFromRequest(requestDetail);
  const { data: createdQuotation, error: createError } = await admin
    .from("booking_quotations")
    .insert({
      quotation_number: quotationPayload.quotationNumber,
      quotation_date: quotationPayload.quotationDate,
      version: 1,
      booking_type: "equipment",
      primary_booking_id: requestDetail.id,
      booking_ids: [requestDetail.id],
      user_id: requestDetail.user_id,
      quotation_payload: quotationPayload,
    })
    .select("*")
    .maybeSingle();

  if (createError) {
    console.error("Error creating PPMU approval quotation:", createError);
    return { error: createError };
  }

  return { quotation: createdQuotation };
}

async function sendProcessedApprovalEmails({ admin, requestDetail, processRecord, ppmu }) {
  const approvedItems = (requestDetail.items || []).filter(
    (item) => item.status === "approved",
  );

  if (
    requestDetail.display_status_type !== OVERALL_STATUS.PROCESSED ||
    approvedItems.length === 0
  ) {
    return { student: null, lecturer: null, pic: null, unitLeader: null };
  }

  const { quotation, error: quotationError } = await getOrCreateQuotationForRequest(
    admin,
    requestDetail,
  );
  const quotationPayload = quotation?.quotation_payload || {};
  let quotationAttachment = null;

  if (!quotationError) {
    try {
      quotationAttachment = {
        filename: `${quotation?.quotation_number || "quotation"}.pdf`,
        content: createQuotationPdfBuffer({
          ...quotationPayload,
          studentStatus: quotationPayload.studentStatus || requestDetail.study_level,
          lecturerName: quotationPayload.lecturerName || requestDetail.lect_name,
          lecturerEmail: quotationPayload.lecturerEmail || requestDetail.lect_email,
          lecturerContact: quotationPayload.lecturerContact || requestDetail.lect_contact,
          lecturerFaculty:
            quotationPayload.lecturerFaculty || requestDetail.lect_faculty,
          lecturerId: quotationPayload.lecturerId || requestDetail.lect_id,
        }),
        contentType: "application/pdf",
      };
    } catch (pdfError) {
      console.error("Error generating quotation PDF attachment:", pdfError);
    }
  }

  const bookingForEmail = {
    ...requestDetail,
    booking_type: "equipment",
    item_id: requestDetail.id,
    item_name:
      requestDetail.items?.length === 1
        ? requestDetail.items[0]?.equipment_name || requestDetail.items[0]?.equipment_id
        : `${requestDetail.items?.length || 0} equipment items`,
    start_time: requestDetail.start_time || requestDetail.items?.[0]?.start_time || "",
    end_time: requestDetail.end_time || requestDetail.items?.[0]?.end_time || "",
  };
  const unitLeaderRecipients = getUniqueRecipients(
    (requestDetail.items || []).map((item) => ({
      username: item.unit_leader_name || "",
      email: item.unit_leader_email || "",
    })),
  );
  const attachmentError = {
    sent: false,
    error: quotationError?.message || "Quotation PDF attachment could not be generated.",
  };
  const studentEmail = quotationAttachment
    ? await sendPpmuDecisionRecipientEmail({
        booking: bookingForEmail,
        recipient: {
          username: requestDetail.user_name || "",
          email: requestDetail.user_email || "",
        },
        recipientRole: "student",
        ppmu,
        processRecord,
        attachments: [quotationAttachment],
      })
    : attachmentError;
  const lecturerEmail = quotationAttachment
    ? await sendPpmuDecisionRecipientEmail({
        booking: bookingForEmail,
        recipient: {
          username: requestDetail.lect_name || "",
          email: requestDetail.lect_email || "",
        },
        recipientRole: "lecturer",
        ppmu,
        processRecord,
        attachments: [quotationAttachment],
      })
    : attachmentError;
  const picEmail = await sendPpmuDecisionRecipientEmail({
    booking: bookingForEmail,
    recipient: {
      username: requestDetail.pic_name || "",
      email: requestDetail.pic_email || "",
    },
    recipientRole: "pic",
    ppmu,
    processRecord,
  });
  const unitLeaderEmails = [];

  for (const unitLeader of unitLeaderRecipients) {
    unitLeaderEmails.push(
      await sendPpmuDecisionRecipientEmail({
        booking: bookingForEmail,
        recipient: unitLeader,
        recipientRole: "unit_leader",
        ppmu,
        processRecord,
      }),
    );
  }

  return {
    student: studentEmail,
    lecturer: lecturerEmail,
    pic: picEmail,
    unitLeader: unitLeaderEmails,
    quotation: quotationError ? { sent: false, error: quotationError.message } : quotation,
  };
}

async function sendPpmuRejectionEmails({ requestDetail, processRecord, ppmu }) {
  const bookingForEmail = {
    ...requestDetail,
    booking_type: "equipment",
    item_id: requestDetail.id,
    item_name:
      requestDetail.items?.length === 1
        ? requestDetail.items[0]?.equipment_name || requestDetail.items[0]?.equipment_id
        : `${requestDetail.items?.length || 0} equipment items`,
    start_time: requestDetail.start_time || requestDetail.items?.[0]?.start_time || "",
    end_time: requestDetail.end_time || requestDetail.items?.[0]?.end_time || "",
  };
  const unitLeaderRecipients = getUniqueRecipients(
    (requestDetail.items || []).map((item) => ({
      username: item.unit_leader_name || "",
      email: item.unit_leader_email || "",
    })),
  );
  const notifications = {
    student: await sendPpmuDecisionRecipientEmail({
      booking: bookingForEmail,
      recipient: {
        username: requestDetail.user_name || "",
        email: requestDetail.user_email || "",
      },
      recipientRole: "student",
      ppmu,
      processRecord,
    }),
    lecturer: await sendPpmuDecisionRecipientEmail({
      booking: bookingForEmail,
      recipient: {
        username: requestDetail.lect_name || "",
        email: requestDetail.lect_email || "",
      },
      recipientRole: "lecturer",
      ppmu,
      processRecord,
    }),
    pic: await sendPpmuDecisionRecipientEmail({
      booking: bookingForEmail,
      recipient: {
        username: requestDetail.pic_name || "",
        email: requestDetail.pic_email || "",
      },
      recipientRole: "pic",
      ppmu,
      processRecord,
    }),
    unitLeader: [],
  };

  for (const unitLeader of unitLeaderRecipients) {
    notifications.unitLeader.push(
      await sendPpmuDecisionRecipientEmail({
        booking: bookingForEmail,
        recipient: unitLeader,
        recipientRole: "unit_leader",
        ppmu,
        processRecord,
      }),
    );
  }

  return notifications;
}

export async function GET(request, { params }) {
  try {
    const { type, id } = await params;
    const parsed = parseRouteParams(type, id);

    if (!parsed) {
      return NextResponse.json({ error: "Invalid PPMU request." }, { status: 400 });
    }

    const { error: authError } = await requirePpmuRequester(request);

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
    console.error("Error in GET /api/ppmu/[type]/[id]:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading this PPMU request." },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { type, id } = await params;
    const parsed = parseRouteParams(type, id);

    if (!parsed) {
      return NextResponse.json({ error: "Invalid PPMU request." }, { status: 400 });
    }

    const { requester, error: authError } = await requirePpmuRequester(request);

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status },
      );
    }

    const body = await request.json();
    const itemId = Number(body?.itemId);
    const decision = String(body?.decision || "").trim().toLowerCase();
    const defaultRemarks = decision === "approved" ? "Approved by PPMU" : "Rejected by PPMU";
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

    const { data: unitLeaderProcess, error: unitLeaderError } = await admin
      .from("booking_process")
      .select("id")
      .eq("booking_type", "equipment")
      .eq("booking_id", itemId)
      .eq("reviewer_role", "unit_leader")
      .eq("decision", "approved")
      .maybeSingle();

    if (unitLeaderError) {
      console.error("Error checking unit leader approval:", unitLeaderError);
      return NextResponse.json(
        { error: "Could not verify unit leader recommendation." },
        { status: 500 },
      );
    }

    if (!unitLeaderProcess) {
      return NextResponse.json(
        { error: "Only unit leader recommended items can be reviewed by PPMU." },
        { status: 400 },
      );
    }

    const { data: existingProcess, error: existingProcessError } = await admin
      .from("booking_process")
      .select("id")
      .eq("booking_type", "equipment")
      .eq("booking_id", itemId)
      .eq("reviewer_role", "ppmu")
      .maybeSingle();

    if (existingProcessError) {
      console.error("Error checking existing PPMU decision:", existingProcessError);
      return NextResponse.json(
        { error: "Could not verify existing decision." },
        { status: 500 },
      );
    }

    if (existingProcess) {
      return NextResponse.json(
        { error: "PPMU decision has already been made for this item." },
        { status: 409 },
      );
    }

    const { data: processRecord, error: insertError } = await admin
      .from("booking_process")
      .insert({
        booking_type: "equipment",
        booking_id: itemId,
        reviewer_id: requester.id,
        reviewer_role: "ppmu",
        decision,
        rejection_reason: decision === "rejected" ? remarks : null,
        remarks,
      })
      .select("*")
      .maybeSingle();

    if (insertError) {
      console.error("Error inserting PPMU process record:", insertError);
      return NextResponse.json(
        { error: "Could not save the PPMU decision." },
        { status: 500 },
      );
    }

    const { error: statusError } = await admin
      .from("equipment_bookings")
      .update({ status: decision })
      .eq("id", itemId);

    if (statusError) {
      console.error("Error updating PPMU item status:", statusError);
      return NextResponse.json(
        { error: "Decision saved, but item status could not be updated." },
        { status: 500 },
      );
    }

    await refreshParentStatus(admin, parsed.id);
    const { request: updatedRequestDetail, error: updatedDetailError } =
      await getRequestDetail(admin, parsed.id);
    let approvalNotifications = null;

    if (updatedDetailError) {
      console.error("Error loading request after PPMU decision:", updatedDetailError);
    } else if (updatedRequestDetail) {
      try {
        if (decision === "approved") {
          approvalNotifications = await sendProcessedApprovalEmails({
            admin,
            requestDetail: updatedRequestDetail,
            processRecord,
            ppmu: requester,
          });
        } else {
          approvalNotifications = {
            rejection: await sendPpmuRejectionEmails({
              requestDetail: updatedRequestDetail,
              processRecord,
              ppmu: requester,
            }),
            processedApproval: await sendProcessedApprovalEmails({
              admin,
              requestDetail: updatedRequestDetail,
              processRecord: {
                ...processRecord,
                decision: "approved",
                remarks: "Approved items are listed in the attached quotation.",
                rejection_reason: null,
              },
              ppmu: requester,
            }),
          };
        }
      } catch (notificationError) {
        console.error("Error sending PPMU approval notifications:", notificationError);
        approvalNotifications = {
          student: { sent: false, error: notificationError.message },
          lecturer: { sent: false, error: notificationError.message },
          pic: { sent: false, error: notificationError.message },
          unitLeader: { sent: false, error: notificationError.message },
        };
      }
    }

    return NextResponse.json(
      {
        message:
          decision === "approved" ? "Equipment item approved." : "Equipment item rejected.",
        process: processRecord,
        notifications: approvalNotifications,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/ppmu/[type]/[id]:", error);
    return NextResponse.json(
      { error: "Something went wrong while saving the PPMU decision." },
      { status: 500 },
    );
  }
}
