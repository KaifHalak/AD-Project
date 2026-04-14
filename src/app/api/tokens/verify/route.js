import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";

function getAccessTokenFromHeader(request) {
  const authorizationHeader = request.headers.get("authorization") || "";

  if (!authorizationHeader.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice(7).trim();
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
        message: "Please log in to verify this code.",
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

  return {
    requester,
    scopedClient,
  };
}

function isCodeFormatValid(code) {
  return typeof code === "string" && /^[A-Z0-9]{6}$/.test(code);
}

export async function POST(request) {
  try {
    const accessToken = getAccessTokenFromHeader(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Please log in to verify this code." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const picCode = body?.picCode?.trim()?.toUpperCase();

    if (!isCodeFormatValid(picCode)) {
      return NextResponse.json(
        { error: "Please enter a valid 6-character PIC code." },
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

    if (requester.role === "pic") {
      return NextResponse.json(
        {
          message: "PIC users do not require token verification.",
          valid: true,
          bypassVerification: true,
          expiresAt: null,
          verifiedFor: requester.email,
        },
        { status: 200 },
      );
    }

    const { data: assignedToken, error: assignedTokenError } =
      await scopedClient
        .from("pic_tokens")
        .select("id, token, expires_at, manual_expire, assigned_to, created_at")
        .eq("token", picCode)
        .eq("assigned_to", requester.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (assignedTokenError) {
      console.error("Error checking assigned token:", assignedTokenError);
      return NextResponse.json(
        { error: "Could not verify this code right now." },
        { status: 500 },
      );
    }

    if (assignedToken) {
      if (isTokenExpired(assignedToken)) {
        return NextResponse.json(
          { error: "This code has expired." },
          { status: 400 },
        );
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
        return NextResponse.json(
          { error: "Code valid, but could not persist verification state." },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          message: "Code verified successfully.",
          valid: true,
          expiresAt: assignedToken.expires_at,
          verifiedFor: requester.email,
        },
        { status: 200 },
      );
    }

    const { data: anyToken, error: anyTokenError } = await scopedClient
      .from("pic_tokens")
      .select("id")
      .eq("token", picCode)
      .limit(1)
      .maybeSingle();

    if (anyTokenError) {
      console.error("Error checking token existence:", anyTokenError);
      return NextResponse.json(
        { error: "Could not verify this code right now." },
        { status: 500 },
      );
    }

    if (anyToken) {
      return NextResponse.json(
        { error: "This code is not assigned to your account." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Invalid code. Please check and try again." },
      { status: 404 },
    );
  } catch (error) {
    console.error("Error in token verification API:", error);
    return NextResponse.json(
      { error: "Something went wrong while verifying the code." },
      { status: 500 },
    );
  }
}
