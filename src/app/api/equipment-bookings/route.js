import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
  verifyPicToken,
} from "@/lib/bookingTokenAuth";

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
    const startTime = body?.startTime;
    const endTime = body?.endTime;
    const picCode = body?.picCode?.trim()?.toUpperCase();

    if (!equipmentId || !bookingDate || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required booking fields." },
        { status: 400 },
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "End time must be after start time." },
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

    const admin = getSupabaseAdminClient();
    const { data: conflict, error: conflictError } = await admin
      .from("equipment_bookings")
      .select("id")
      .eq("equipment_id", equipmentId)
      .eq("booking_date", bookingDate)
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
        { error: "Time slot not available. Please select another time." },
        { status: 409 },
      );
    }

    const { data: booking, error: insertError } = await admin
      .from("equipment_bookings")
      .insert({
        equipment_id: equipmentId,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        status: "pending",
        user_id: requester.id,
      })
      .select("*")
      .maybeSingle();

    if (insertError) {
      console.error("Error creating equipment booking:", insertError);
      return NextResponse.json(
        { error: "Booking failed. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Booking submitted. Waiting for approval.", booking },
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
