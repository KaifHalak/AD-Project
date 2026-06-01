import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";

const BOOKING_TABLES = {
  lab: "lab_bookings",
  equipment: "equipment_bookings",
};

function getDateString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateText(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function normalizeBookingIds(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

export async function POST(request) {
  try {
    const accessToken = getAccessTokenFromHeader(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Missing access token." },
        { status: 401 },
      );
    }

    const {
      requester,
      error: requesterError,
    } = await getRequesterProfile(
      accessToken,
      "Please log in before saving a quotation.",
    );

    if (requesterError) {
      return NextResponse.json(
        { error: requesterError.message },
        { status: requesterError.status },
      );
    }

    const body = await request.json();
    const bookingType = String(body?.bookingType || body?.booking_type || "");
    const tableName = BOOKING_TABLES[bookingType];
    const primaryBookingId = Number(body?.primaryBookingId);
    const bookingIds = normalizeBookingIds(body?.bookingIds);
    const quotationNumber = String(body?.quotationNumber || "").trim();
    const quotationDate = body?.quotationDate || getDateString();
    const quotationPayload = body?.quotationPayload;

    if (!tableName) {
      return NextResponse.json(
        { error: "Invalid quotation booking type." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(primaryBookingId) || primaryBookingId <= 0) {
      return NextResponse.json(
        { error: "Invalid primary booking ID." },
        { status: 400 },
      );
    }

    if (!bookingIds.includes(primaryBookingId)) {
      return NextResponse.json(
        { error: "Primary booking ID must be included in booking IDs." },
        { status: 400 },
      );
    }

    if (!quotationNumber || !quotationPayload || typeof quotationPayload !== "object") {
      return NextResponse.json(
        { error: "Missing quotation details." },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: ownedBookings, error: bookingsError } = await admin
      .from(tableName)
      .select("id, user_id")
      .in("id", bookingIds)
      .eq("user_id", requester.id);

    if (bookingsError) {
      console.error("Error validating quotation booking ownership:", bookingsError);
      return NextResponse.json(
        { error: "Could not validate quotation bookings." },
        { status: 500 },
      );
    }

    if ((ownedBookings || []).length !== bookingIds.length) {
      return NextResponse.json(
        { error: "You do not have permission to save this quotation." },
        { status: 403 },
      );
    }

    const payloadToSave = {
      ...quotationPayload,
      quotationNumber,
      quotationDate:
        quotationPayload.quotationDate || formatDateText(quotationDate),
    };

    const { data: quotation, error: quotationError } = await admin
      .from("booking_quotations")
      .upsert(
        {
          quotation_number: quotationNumber,
          quotation_date: quotationDate,
          booking_type: bookingType,
          primary_booking_id: primaryBookingId,
          booking_ids: bookingIds,
          user_id: requester.id,
          quotation_payload: payloadToSave,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "booking_type,primary_booking_id" },
      )
      .select(
        "id, quotation_number, quotation_date, booking_type, primary_booking_id, booking_ids, quotation_payload",
      )
      .maybeSingle();

    if (quotationError) {
      console.error("Error saving booking quotation:", quotationError);
      return NextResponse.json(
        { error: "Could not save quotation." },
        { status: 500 },
      );
    }

    return NextResponse.json({ quotation }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/booking-quotations:", error);
    return NextResponse.json(
      { error: "Something went wrong while saving the quotation." },
      { status: 500 },
    );
  }
}
