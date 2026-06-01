import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";

const ALLOWED_STATUSES = ["cancelled"];

function getAccessTokenFromHeader(request) {
  const authorizationHeader = request.headers.get("authorization") || "";
  if (!authorizationHeader.startsWith("Bearer ")) return "";
  return authorizationHeader.slice(7).trim();
}

function parseBookingId(id) {
  const match = /^(lab|equipment)-(\d+)$/.exec(id || "");

  if (!match) {
    return null;
  }

  const bookingType = match[1];
  return {
    bookingType,
    sourceId: Number(match[2]),
    tableName: bookingType === "lab" ? "lab_bookings" : "equipment_bookings",
    itemColumn: bookingType === "lab" ? "lab_id" : "equipment_id",
  };
}

async function resolveUserProfile(accessToken) {
  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);

  if (authError || !authData?.user?.email) {
    return {
      error: { status: 401, message: "Unauthorized. Please log in again." },
    };
  }

  const scopedClient = getSupabaseServerClient(accessToken);
  const { data: profile, error: profileError } = await scopedClient
    .from("users")
    .select("id, email, role")
    .eq("email", authData.user.email)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: { status: 403, message: "Could not verify your account." } };
  }

  return { profile };
}

async function enrichBooking(admin, booking) {
  if (!booking) {
    return null;
  }

  const tableName = booking.booking_type === "lab" ? "labs" : "equipment";
  const fallbackType = booking.booking_type === "lab" ? "Lab" : "Equipment";
  const { data: item, error } = await admin
    .from(tableName)
    .select("id, name, location, course")
    .eq("id", booking.item_id)
    .maybeSingle();

  if (error) {
    console.error(`Error enriching ${booking.booking_type} booking:`, error);
  }

  const subtitle = [item?.course, item?.location].filter(Boolean).join(" | ");

  return {
    ...booking,
    resource_name: item?.name || `${fallbackType} ${booking.item_id}`,
    resource_subtitle: subtitle || booking.item_id,
  };
}

function getProcessTime(process) {
  return new Date(process?.decision_at || process?.created_at || 0).getTime();
}

function getLatestProcessByRole(processes, reviewerRole) {
  return (processes || [])
    .filter((process) => process.reviewer_role === reviewerRole)
    .sort((a, b) => getProcessTime(b) - getProcessTime(a))[0];
}

function getDisplayStatus(booking, unitLeaderProcess, ppmuProcess) {
  if (booking.status === "cancelled") {
    return {
      display_status: "Cancelled",
      display_status_type: "cancelled",
      rejection_reason: "",
      is_final_approved: false,
    };
  }

  if (!unitLeaderProcess) {
    return {
      display_status: "Pending Unit Leader Approval",
      display_status_type: "pending",
      rejection_reason: "",
      is_final_approved: false,
    };
  }

  if (unitLeaderProcess.decision === "rejected") {
    return {
      display_status: "Rejected by Unit Leader",
      display_status_type: "rejected",
      rejection_reason:
        unitLeaderProcess.rejection_reason || unitLeaderProcess.remarks || "",
      is_final_approved: false,
    };
  }

  if (!ppmuProcess) {
    return {
      display_status: "Approved by Unit Leader, Pending Approval by PPMU",
      display_status_type: "pending",
      rejection_reason: "",
      is_final_approved: false,
    };
  }

  if (ppmuProcess.decision === "rejected") {
    return {
      display_status: "Rejected by PPMU",
      display_status_type: "rejected",
      rejection_reason: ppmuProcess.rejection_reason || ppmuProcess.remarks || "",
      is_final_approved: false,
    };
  }

  return {
    display_status: "Approved",
    display_status_type: "approved",
    rejection_reason: "",
    is_final_approved: ppmuProcess.decision === "approved",
  };
}

function getDecisionLabel(decision) {
  if (decision === "approved") return "Approved";
  if (decision === "rejected") return "Rejected";
  return "Pending";
}

async function getSourceBooking(admin, parsedBooking) {
  const selectColumns = `id, user_id, status, booking_date, start_time, end_time, booking_reason, requester_identifier, requester_faculty, requester_contact, ${parsedBooking.itemColumn}`;
  const { data, error } = await admin
    .from(parsedBooking.tableName)
    .select(selectColumns)
    .eq("id", parsedBooking.sourceId)
    .maybeSingle();

  return { data, error };
}

async function getQuotation(admin, parsedBooking, userId) {
  const { data, error } = await admin
    .from("booking_quotations")
    .select("id, quotation_number, quotation_date, quotation_payload")
    .eq("booking_type", parsedBooking.bookingType)
    .eq("user_id", userId)
    .contains("booking_ids", [parsedBooking.sourceId])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
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

    const { profile, error } = await resolveUserProfile(accessToken);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const { id } = await params;
    const parsedBooking = parseBookingId(id);

    if (!parsedBooking) {
      return NextResponse.json({ error: "Invalid booking ID." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    const { data: booking, error: fetchError } = await admin
      .from("bookings")
      .select(
        "id, booking_type, item_id, user_id, booking_date, start_time, end_time, status, item_name, grant_number, vot_number, total_price, created_at, token, assigned_by_id",
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.user_id !== profile.id) {
      return NextResponse.json(
        { error: "You do not have permission to view this booking." },
        { status: 403 },
      );
    }

    const [
      enrichedBooking,
      sourceBookingResult,
      processResult,
      quotationResult,
    ] = await Promise.all([
      enrichBooking(admin, booking),
      getSourceBooking(admin, parsedBooking),
      admin
        .from("booking_process")
        .select("*")
        .eq("booking_type", parsedBooking.bookingType)
        .eq("booking_id", parsedBooking.sourceId),
      getQuotation(admin, parsedBooking, profile.id),
    ]);

    if (sourceBookingResult.error) {
      console.error("Error fetching booking reason:", sourceBookingResult.error);
    }

    if (processResult.error) {
      console.error("Error fetching booking processes:", processResult.error);
      return NextResponse.json(
        { error: "Could not fetch booking review details." },
        { status: 500 },
      );
    }

    if (quotationResult.error) {
      console.error("Error fetching booking quotation:", quotationResult.error);
    }

    const unitLeaderProcess = getLatestProcessByRole(
      processResult.data,
      "unit_leader",
    );
    const ppmuProcess = getLatestProcessByRole(processResult.data, "ppmu");
    const reviewerIds = [
      unitLeaderProcess?.reviewer_id,
      ppmuProcess?.reviewer_id,
    ].filter(Boolean);
    const userIds = [
      ...new Set([booking.user_id, booking.assigned_by_id, ...reviewerIds].filter(Boolean)),
    ];

    const { data: users, error: usersError } = userIds.length
      ? await admin
          .from("users")
          .select("id, username, email, role")
          .in("id", userIds)
      : { data: [], error: null };

    if (usersError) {
      console.error("Error fetching booking detail users:", usersError);
      return NextResponse.json(
        { error: "Could not fetch booking user details." },
        { status: 500 },
      );
    }

    const usersById = new Map((users || []).map((user) => [user.id, user]));
    const requester = usersById.get(booking.user_id);
    const picUser = usersById.get(booking.assigned_by_id);
    const unitLeader = usersById.get(unitLeaderProcess?.reviewer_id);
    const ppmu = usersById.get(ppmuProcess?.reviewer_id);
    const displayStatus = getDisplayStatus(
      booking,
      unitLeaderProcess,
      ppmuProcess,
    );

    return NextResponse.json(
      {
        booking: {
          ...enrichedBooking,
          source_status: booking.status,
          source_id: parsedBooking.sourceId,
          booking_reason: sourceBookingResult.data?.booking_reason || "",
          requester_identifier:
            sourceBookingResult.data?.requester_identifier || "",
          requester_faculty: sourceBookingResult.data?.requester_faculty || "",
          requester_contact: sourceBookingResult.data?.requester_contact || "",
          pic_token: booking.token || "",
          pic_name: picUser?.username || "N/A",
          pic_email: picUser?.email || "N/A",
          user_name: requester?.username || "Unknown",
          user_email: requester?.email || "Unknown",
          user_role: requester?.role || "Unknown",
          unit_leader_decision: unitLeaderProcess?.decision || "pending",
          unit_leader_status: getDecisionLabel(unitLeaderProcess?.decision),
          unit_leader_date: unitLeaderProcess?.decision_at || null,
          unit_leader_remarks: unitLeaderProcess?.remarks || "",
          unit_leader_rejection_reason:
            unitLeaderProcess?.rejection_reason ||
            unitLeaderProcess?.remarks ||
            "",
          unit_leader_name: unitLeader?.username || "N/A",
          unit_leader_email: unitLeader?.email || "N/A",
          unit_leader_role: unitLeader?.role || "N/A",
          ppmu_decision: ppmuProcess?.decision || "pending",
          ppmu_status: getDecisionLabel(ppmuProcess?.decision),
          ppmu_date: ppmuProcess?.decision_at || null,
          ppmu_remarks: ppmuProcess?.remarks || "",
          ppmu_rejection_reason:
            ppmuProcess?.rejection_reason || ppmuProcess?.remarks || "",
          ppmu_name: ppmu?.username || "N/A",
          ppmu_email: ppmu?.email || "N/A",
          ppmu_role: ppmu?.role || "N/A",
          quotation: quotationResult.data
            ? {
                quotation_number: quotationResult.data.quotation_number,
                quotation_date: quotationResult.data.quotation_date,
                quotation_payload: quotationResult.data.quotation_payload,
              }
            : null,
          ...displayStatus,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/bookings/[id]:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const accessToken = getAccessTokenFromHeader(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Missing access token." },
        { status: 401 },
      );
    }

    const { profile, error } = await resolveUserProfile(accessToken);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const { id } = await params;
    const parsedBooking = parseBookingId(id);

    if (!parsedBooking) {
      return NextResponse.json({ error: "Invalid booking ID." }, { status: 400 });
    }

    const body = await request.json();
    const { status, booking_date, start_time, end_time } = body;
    const admin = getSupabaseAdminClient();
    const { data: existing, error: fetchError } = await getSourceBooking(
      admin,
      parsedBooking,
    );

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (existing.user_id !== profile.id) {
      return NextResponse.json(
        { error: "You do not have permission to update this booking." },
        { status: 403 },
      );
    }

    if (existing.status === "cancelled") {
      return NextResponse.json(
        { error: "This booking is already cancelled." },
        { status: 400 },
      );
    }

    const updates = {};

    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: "Only cancellation is allowed from this endpoint." },
          { status: 400 },
        );
      }
      updates.status = status;
    }

    if (booking_date || start_time || end_time) {
      return NextResponse.json(
        {
          error:
            "Rescheduling now creates a new booking request. Use the booking page to submit a new request.",
        },
        { status: 400 },
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No booking updates provided." },
        { status: 400 },
      );
    }

    const { data: updated, error: updateError } = await admin
      .from(parsedBooking.tableName)
      .update(updates)
      .eq("id", parsedBooking.sourceId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error("Error updating booking:", updateError);
      return NextResponse.json(
        { error: "Could not update booking." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Booking updated successfully.", booking: updated },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/bookings/[id]:", error);
    return NextResponse.json(
      { error: "Something went wrong while updating the booking." },
      { status: 500 },
    );
  }
}
