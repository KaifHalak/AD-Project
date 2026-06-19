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

const ALLOWED_STATUSES = ["cancelled"];

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
    console.error("Error loading booking PIC token:", tokenError);
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
    console.error("Error loading booking PIC user:", picUserError);
  }

  return {
    picName: booking.pic_name || picUser?.username || "",
    picEmail: booking.pic_email || picUser?.email || "",
  };
}

async function getBookingDetail(admin, bookingId) {
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
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (itemsError) {
    return { error: itemsError };
  }

  const equipmentIds = [...new Set((items || []).map((item) => item.equipment_id))];
  const labIds = [...new Set((items || []).map((item) => item.lab_id))];
  const [equipmentResult, labsResult, processesResult] = await Promise.all([
    equipmentIds.length
      ? admin
          .from("equipment")
          .select("id, name, description, course, location, lab_id, price_per_hour, staff_name, staff_email, staff_contact")
          .in("id", equipmentIds)
      : Promise.resolve({ data: [], error: null }),
    labIds.length
      ? admin.from("labs").select("id, name, course, location").in("id", labIds)
      : Promise.resolve({ data: [], error: null }),
    items?.length
      ? admin
          .from("booking_process")
          .select("*")
          .eq("booking_type", "equipment")
          .in(
            "booking_id",
            items.map((item) => item.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (equipmentResult.error) console.error("Error loading equipment:", equipmentResult.error);
  if (labsResult.error) console.error("Error loading labs:", labsResult.error);
  if (processesResult.error) console.error("Error loading processes:", processesResult.error);

  const equipmentById = new Map((equipmentResult.data || []).map((item) => [item.id, item]));
  const labsById = new Map((labsResult.data || []).map((lab) => [lab.id, lab]));
  const reviewerIds = [
    ...new Set((processesResult.data || []).map((process) => process.reviewer_id).filter(Boolean)),
  ];
  const { data: reviewerUsers, error: reviewerUsersError } = reviewerIds.length
    ? await admin.from("users").select("id, username, email").in("id", reviewerIds)
    : { data: [], error: null };
  const reviewerUsersById = new Map((reviewerUsers || []).map((user) => [user.id, user]));
  const processesByItem = new Map();

  if (reviewerUsersError) {
    console.error("Error loading booking process reviewers:", reviewerUsersError);
  }

  for (const process of processesResult.data || []) {
    const key = Number(process.booking_id);
    const reviewer = reviewerUsersById.get(process.reviewer_id);
    processesByItem.set(key, [
      ...(processesByItem.get(key) || []),
      {
        ...process,
        reviewer_name: reviewer?.username || "",
        reviewer_email: reviewer?.email || "",
      },
    ]);
  }

  const enrichedItems = (items || []).map((item) => {
    const equipment = equipmentById.get(item.equipment_id);
    const lab = labsById.get(item.lab_id);
    const processes = processesByItem.get(item.id) || [];

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
      unit_leader_process: processes.find((process) => process.reviewer_role === "unit_leader") || null,
      ppmu_process: processes.find((process) => process.reviewer_role === "ppmu") || null,
    };
  });

  const status = booking.overall_status || deriveOverallStatus(items || []);
  const { picName, picEmail } = await getPicDetailsForBooking(admin, booking);

  return {
    booking: {
      ...booking,
      pic_name: picName,
      pic_email: picEmail,
      items: enrichedItems,
      item_count: enrichedItems.length,
      display_status: getDisplayStatus(status),
      display_status_type: status,
      source_status: status,
      estimated_total_price: enrichedItems.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0,
      ),
      total_price: booking.final_total_price,
      pic_token: booking.token || "",
    },
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
    const { booking, error } = await getBookingDetail(admin, bookingId);

    if (error || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.user_id !== requester.id && !["unit_leader", "ppmu"].includes(requester.role)) {
      return NextResponse.json(
        { error: "You do not have permission to view this booking." },
        { status: 403 },
      );
    }

    const userIds = [booking.user_id].filter(Boolean);
    const { data: users, error: usersError } = userIds.length
      ? await admin.from("users").select("id, username, email, role").in("id", userIds)
      : { data: [], error: null };

    if (usersError) {
      console.error("Error loading booking user:", usersError);
    }

    const requesterProfile = (users || [])[0];

    return NextResponse.json(
      {
        booking: {
          ...booking,
          user_name: requesterProfile?.username || "Unknown",
          user_email: requesterProfile?.email || "Unknown",
          user_role: requesterProfile?.role || "Unknown",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/bookings/[id]:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
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

    const body = await request.json();
    const { status } = body;

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Only cancellation is allowed from this endpoint." },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: existing, error: fetchError } = await admin
      .from("bookings")
      .select("id, user_id, overall_status")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (existing.user_id !== requester.id) {
      return NextResponse.json(
        { error: "You do not have permission to update this booking." },
        { status: 403 },
      );
    }

    if (existing.overall_status === OVERALL_STATUS.CANCELLED) {
      return NextResponse.json(
        { error: "This booking is already cancelled." },
        { status: 400 },
      );
    }

    const { error: childError } = await admin
      .from("equipment_bookings")
      .update({ status: "cancelled" })
      .eq("booking_id", bookingId)
      .not("status", "in", "(approved,rejected)");

    if (childError) {
      console.error("Error cancelling booking items:", childError);
      return NextResponse.json(
        { error: "Could not cancel booking items." },
        { status: 500 },
      );
    }

    const { data: updated, error: updateError } = await admin
      .from("bookings")
      .update({
        overall_status: OVERALL_STATUS.CANCELLED,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error("Error cancelling booking:", updateError);
      return NextResponse.json(
        { error: "Could not cancel booking." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Booking cancelled successfully.", booking: updated },
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
