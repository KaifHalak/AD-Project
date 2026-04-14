import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";

const VERIFIED_COOKIE_KEY = "booking_verified";
const VERIFIED_FOR_COOKIE_KEY = "booking_verified_for";
const VERIFIED_UNTIL_COOKIE_KEY = "booking_verified_until";

function getAccessTokenFromHeader(request) {
  const authorizationHeader = request.headers.get("authorization") || "";

  if (!authorizationHeader.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice(7).trim();
}

function clearVerificationCookies(response) {
  response.cookies.set(VERIFIED_COOKIE_KEY, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(VERIFIED_FOR_COOKIE_KEY, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(VERIFIED_UNTIL_COOKIE_KEY, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function setVerificationCookies(response, { verifiedFor, expiresAt }) {
  const expiryMs = new Date(expiresAt).getTime();
  const maxAge = Math.max(1, Math.floor((expiryMs - Date.now()) / 1000));

  response.cookies.set(VERIFIED_COOKIE_KEY, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  response.cookies.set(VERIFIED_FOR_COOKIE_KEY, verifiedFor, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  response.cookies.set(VERIFIED_UNTIL_COOKIE_KEY, expiresAt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

function isVerificationActive(userRow) {
  if (userRow.verified !== true) {
    return false;
  }

  const expiryMs = new Date(userRow.verification_expiry).getTime();

  if (Number.isNaN(expiryMs)) {
    return false;
  }

  return expiryMs > Date.now();
}

export async function GET(request) {
  try {
    const accessToken = getAccessTokenFromHeader(request);

    if (!accessToken) {
      const response = NextResponse.json(
        { error: "Unauthorized. Missing access token." },
        { status: 401 },
      );
      clearVerificationCookies(response);
      return response;
    }

    const supabase = getSupabaseServerClient();
    const { data: authData, error: authError } =
      await supabase.auth.getUser(accessToken);

    if (authError || !authData?.user?.email) {
      const response = NextResponse.json(
        { error: "Unauthorized. Please log in again." },
        { status: 401 },
      );
      clearVerificationCookies(response);
      return response;
    }

    const cookieVerified = request.cookies.get(VERIFIED_COOKIE_KEY)?.value;
    const cookieVerifiedFor = request.cookies.get(
      VERIFIED_FOR_COOKIE_KEY,
    )?.value;
    const cookieVerifiedUntil = request.cookies.get(
      VERIFIED_UNTIL_COOKIE_KEY,
    )?.value;

    const cookieExpiryMs = new Date(cookieVerifiedUntil || "").getTime();
    const cookieSessionActive =
      cookieVerified === "1" &&
      cookieVerifiedFor?.toLowerCase() === authData.user.email.toLowerCase() &&
      !Number.isNaN(cookieExpiryMs) &&
      cookieExpiryMs > Date.now();

    if (cookieSessionActive) {
      return NextResponse.json(
        {
          verified: true,
          bypassVerification: false,
          role: "user",
          expiresAt: cookieVerifiedUntil,
        },
        { status: 200 },
      );
    }

    const scopedClient = getSupabaseServerClient(accessToken);
    const { data: userProfile, error: userError } = await scopedClient
      .from("users")
      .select("id, email, role, verified, verification_expiry")
      .eq("email", authData.user.email)
      .maybeSingle();

    if (userError || !userProfile) {
      const response = NextResponse.json(
        { error: "Could not verify account details." },
        { status: 403 },
      );
      clearVerificationCookies(response);
      return response;
    }

    if (userProfile.role === "pic") {
      const response = NextResponse.json(
        {
          verified: true,
          bypassVerification: true,
          role: userProfile.role,
          expiresAt: null,
        },
        { status: 200 },
      );

      clearVerificationCookies(response);
      return response;
    }

    const verifiedActive = isVerificationActive(userProfile);

    if (!verifiedActive && userProfile.verified === true) {
      await scopedClient
        .from("users")
        .update({ verified: false, verification_expiry: null })
        .eq("id", userProfile.id);
    }

    const response = NextResponse.json(
      {
        verified: verifiedActive,
        bypassVerification: false,
        role: userProfile.role,
        expiresAt: userProfile.verification_expiry || null,
      },
      { status: 200 },
    );

    if (verifiedActive) {
      setVerificationCookies(response, {
        verifiedFor: userProfile.email,
        expiresAt: userProfile.verification_expiry,
      });
    } else {
      clearVerificationCookies(response);
    }

    return response;
  } catch (error) {
    console.error("Error in verification-status API:", error);
    const response = NextResponse.json(
      { error: "Something went wrong while checking verification status." },
      { status: 500 },
    );
    clearVerificationCookies(response);
    return response;
  }
}
