import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";

function getAccessTokenFromHeader(request) {
  const authorizationHeader = request.headers.get("authorization") || "";

  if (!authorizationHeader.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice(7).trim();
}

async function getRequesterProfile(accessToken) {
  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);

  if (authError || !authData?.user?.email) {
    return {
      error: {
        status: 401,
        message: "Unauthorized. Please log in again.",
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
        message: "Could not verify your permissions.",
      },
    };
  }

  if (requester.role !== "pic") {
    return {
      error: {
        status: 403,
        message: "Only PIC users can assign PIC tokens.",
      },
    };
  }

  return {
    requester,
    scopedClient,
  };
}

function isValidToken(token) {
  return typeof token === "string" && /^[A-Z0-9]{6}$/.test(token);
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

    const body = await request.json();
    const token = body?.token?.trim()?.toUpperCase();
    const assignedToUserId = body?.assignedToUserId;
    const expiresAt = body?.expiresAt;

    if (!token || !assignedToUserId || !expiresAt) {
      return NextResponse.json(
        { error: "Token, expiry date, and assigned user are required." },
        { status: 400 },
      );
    }

    if (!isValidToken(token)) {
      return NextResponse.json(
        { error: "Token must be exactly 6 uppercase characters." },
        { status: 400 },
      );
    }

    const expiresAtDate = new Date(expiresAt);

    if (Number.isNaN(expiresAtDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid expiry date." },
        { status: 400 },
      );
    }

    const {
      requester,
      scopedClient,
      error: permissionError,
    } = await getRequesterProfile(accessToken);

    if (permissionError) {
      return NextResponse.json(
        { error: permissionError.message },
        { status: permissionError.status },
      );
    }

    const nowISOString = new Date().toISOString();

    const { error: expireFalseError } = await scopedClient
      .from("pic_tokens")
      .update({ manual_expire: true })
      .eq("assigned_to", assignedToUserId)
      .eq("manual_expire", false)
      .gt("expires_at", nowISOString);

    if (expireFalseError) {
      console.error("Error expiring existing token records:", expireFalseError);
      return NextResponse.json(
        { error: "Could not expire existing valid tokens." },
        { status: 500 },
      );
    }

    const { error: expireNullError } = await scopedClient
      .from("pic_tokens")
      .update({ manual_expire: true })
      .eq("assigned_to", assignedToUserId)
      .is("manual_expire", null)
      .gt("expires_at", nowISOString);

    if (expireNullError) {
      console.error("Error expiring null-flag token records:", expireNullError);
      return NextResponse.json(
        { error: "Could not expire existing valid tokens." },
        { status: 500 },
      );
    }

    const { data: insertedRecord, error: insertError } = await scopedClient
      .from("pic_tokens")
      .insert({
        token,
        created_at: nowISOString,
        expires_at: expiresAtDate.toISOString(),
        assigned_to: assignedToUserId,
        assigned_by: requester.id,
        manual_expire: false,
      })
      .select("token, expires_at, assigned_to, assigned_by, manual_expire")
      .maybeSingle();

    if (insertError) {
      console.error("Error assigning token:", insertError);
      return NextResponse.json(
        { error: "Could not assign token." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "Token assigned successfully.",
        token: insertedRecord,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in assign-token API:", error);
    return NextResponse.json(
      { error: "Something went wrong while assigning the token." },
      { status: 500 },
    );
  }
}
