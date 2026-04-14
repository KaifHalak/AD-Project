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

    const body = await request.json();
    const tokenId = body?.tokenId;

    if (!tokenId) {
      return NextResponse.json(
        { error: "Token id is required." },
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

    const { data: existingToken, error: findError } = await scopedClient
      .from("pic_tokens")
      .select("id, assigned_by")
      .eq("id", tokenId)
      .maybeSingle();

    if (findError) {
      console.error("Error validating token ownership:", findError);
      return NextResponse.json(
        { error: "Could not validate token." },
        { status: 500 },
      );
    }

    if (!existingToken || existingToken.assigned_by !== requester.id) {
      return NextResponse.json(
        { error: "Token not found for your account." },
        { status: 404 },
      );
    }

    const { error: updateError } = await scopedClient
      .from("pic_tokens")
      .update({ manual_expire: true })
      .eq("id", tokenId)
      .eq("assigned_by", requester.id);

    if (updateError) {
      console.error("Error manually expiring token:", updateError);
      return NextResponse.json(
        { error: "Could not manually expire token." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Token expired successfully." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in manual-expire API:", error);
    return NextResponse.json(
      { error: "Something went wrong while expiring token." },
      { status: 500 },
    );
  }
}
