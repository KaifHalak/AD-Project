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
    const email = body?.email?.trim()?.toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "User email is required." },
        { status: 400 },
      );
    }

    const { scopedClient, error: permissionError } =
      await getRequesterProfile(accessToken);

    if (permissionError) {
      return NextResponse.json(
        { error: permissionError.message },
        { status: permissionError.status },
      );
    }

    const { data: foundUser, error: findUserError } = await scopedClient
      .from("users")
      .select("id, username, role, email")
      .eq("email", email)
      .maybeSingle();

    if (findUserError) {
      console.error("Error finding user:", findUserError);
      return NextResponse.json(
        { error: "Could not fetch user details." },
        { status: 500 },
      );
    }

    if (!foundUser) {
      return NextResponse.json({ error: "No user found." }, { status: 404 });
    }

    return NextResponse.json({ user: foundUser }, { status: 200 });
  } catch (error) {
    console.error("Error in find-user API:", error);
    return NextResponse.json(
      { error: "Something went wrong while finding the user." },
      { status: 500 },
    );
  }
}
