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
        { error: "Please log in before booking a lab." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const labId = body?.labId;
    const bookingDate = body?.bookingDate;
    const startTime = body?.startTime;
    const endTime = body?.endTime;
    const picCode = body?.picCode?.trim()?.toUpperCase();

    if (!labId || !bookingDate || !startTime || !endTime) {
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
      "Please log in before booking a lab.",
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
    const { data: lab, error: labError } = await admin
      .from("labs")
      .select("id")
      .eq("id", labId)
      .maybeSingle();

    if (labError || !lab) {
      return NextResponse.json({ error: "Lab not found." }, { status: 404 });
    }

    const { data: conflict, error: conflictError } = await admin
      .from("lab_bookings")
      .select("id")
      .eq("lab_id", labId)
      .eq("booking_date", bookingDate)
      .lt("start_time", endTime)
      .gt("end_time", startTime)
      .neq("status", "rejected")
      .limit(1)
      .maybeSingle();

    if (conflictError) {
      console.error("Error checking lab booking conflict:", conflictError);
      return NextResponse.json(
        { error: "Could not check lab availability." },
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
      .from("lab_bookings")
      .insert({
        lab_id: labId,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        status: "pending",
        user_id: requester.id,
      })
      .select("*")
      .maybeSingle();

    if (insertError) {
      console.error("Error creating lab booking:", insertError);
      return NextResponse.json(
        { error: "Booking failed. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Lab booking submitted. Waiting for approval.", booking },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/lab-bookings:", error);
    return NextResponse.json(
      { error: "Unexpected error while booking a lab." },
      { status: 500 },
    );
  }
}
