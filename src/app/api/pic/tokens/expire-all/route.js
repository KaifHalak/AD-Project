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
        message: "Only PIC users can access this feature.",
      },
    };
  }

  return {
    requester,
    scopedClient,
  };
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

    const { data: expiredFalseRows, error: expireFalseError } =
      await scopedClient
        .from("pic_tokens")
        .update({ manual_expire: true })
        .eq("assigned_by", requester.id)
        .eq("manual_expire", false)
        .gt("expires_at", nowISOString)
        .select("id");

    if (expireFalseError) {
      console.error("Error expiring false-flag tokens:", expireFalseError);
      return NextResponse.json(
        { error: "Could not expire all active tokens." },
        { status: 500 },
      );
    }

    const { data: expiredNullRows, error: expireNullError } = await scopedClient
      .from("pic_tokens")
      .update({ manual_expire: true })
      .eq("assigned_by", requester.id)
      .is("manual_expire", null)
      .gt("expires_at", nowISOString)
      .select("id");

    if (expireNullError) {
      console.error("Error expiring null-flag tokens:", expireNullError);
      return NextResponse.json(
        { error: "Could not expire all active tokens." },
        { status: 500 },
      );
    }

    const expiredCount =
      (expiredFalseRows || []).length + (expiredNullRows || []).length;

    return NextResponse.json(
      {
        message: "All active tokens have been expired.",
        expiredCount,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in expire-all API:", error);
    return NextResponse.json(
      { error: "Something went wrong while expiring all tokens." },
      { status: 500 },
    );
  }
}
