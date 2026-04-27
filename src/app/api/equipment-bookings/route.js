import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";

function getAccessTokenFromHeader(request) {
  const authorizationHeader = request.headers.get("authorization") || "";

  if (!authorizationHeader.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice(7).trim();
}

function isCodeFormatValid(code) {
  return typeof code === "string" && /^[A-Z0-9]{6}$/.test(code);
}

function isTokenExpired(tokenRow) {
  if (tokenRow.manual_expire === true) {
    return true;
  }

  const expiryDate = new Date(tokenRow.expires_at);
  return expiryDate.getTime() <= Date.now();
}

async function getRequesterProfile(accessToken) {
  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);

  if (authError || !authData?.user?.email) {
    return {
      error: {
        status: 401,
        message: "Please log in before booking equipment.",
      },
    };
  }

  const scopedClient = getSupabaseServerClient(accessToken);
  const { data: requester, error: requesterError } = await scopedClient
    .from("users")
    .select("id, email, role")
    .eq("email", authData.user.email)
    .maybeSingle();

  if (requesterError || !requester) {
    return {
      error: {
        status: 403,
        message: "Could not verify your account details.",
      },
    };
  }

  return { requester, scopedClient };
}

async function verifyPicToken({ scopedClient, requester, picCode }) {
  if (requester.role === "pic") {
    return { verified: true };
  }

  if (!isCodeFormatValid(picCode)) {
    return {
      error: {
        status: 400,
        message: "Please enter a valid 6-character PIC code.",
      },
    };
  }

  const { data: assignedToken, error: assignedTokenError } = await scopedClient
    .from("pic_tokens")
    .select("id, token, expires_at, manual_expire, assigned_to, created_at")
    .eq("token", picCode)
    .eq("assigned_to", requester.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assignedTokenError) {
    console.error("Error checking assigned token:", assignedTokenError);
    return {
      error: {
        status: 500,
        message: "Could not verify this code right now.",
      },
    };
  }

  if (assignedToken) {
    if (isTokenExpired(assignedToken)) {
      return {
        error: {
          status: 400,
          message: "This code has expired.",
        },
      };
    }

    const { error: verificationUpdateError } = await scopedClient
      .from("users")
      .update({
        verified: true,
        verification_expiry: assignedToken.expires_at,
      })
      .eq("id", requester.id);

    if (verificationUpdateError) {
      console.error(
        "Error updating user verification state:",
        verificationUpdateError,
      );
      return {
        error: {
          status: 500,
          message: "Code valid, but could not persist verification state.",
        },
      };
    }

    return { verified: true };
  }

  const { data: anyToken, error: anyTokenError } = await scopedClient
    .from("pic_tokens")
    .select("id")
    .eq("token", picCode)
    .limit(1)
    .maybeSingle();

  if (anyTokenError) {
    console.error("Error checking token existence:", anyTokenError);
    return {
      error: {
        status: 500,
        message: "Could not verify this code right now.",
      },
    };
  }

  if (anyToken) {
    return {
      error: {
        status: 403,
        message: "This code is not assigned to your account.",
      },
    };
  }

  return {
    error: {
      status: 404,
      message: "Invalid code. Please check and try again.",
    },
  };
}

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
    } = await getRequesterProfile(accessToken);

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
      .neq("status", "cancelled")
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
