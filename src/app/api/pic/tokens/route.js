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

export async function GET(request) {
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

    const { data: tokenRows, error: tokensError } = await scopedClient
      .from("pic_tokens")
      .select("id, created_at, expires_at, token, assigned_to, manual_expire")
      .eq("assigned_by", requester.id)
      .order("created_at", { ascending: false });

    if (tokensError) {
      console.error("Error fetching PIC tokens:", tokensError);
      return NextResponse.json(
        { error: "Could not load token records." },
        { status: 500 },
      );
    }

    const assignedUserIds = [
      ...new Set(
        (tokenRows || []).map((row) => row.assigned_to).filter(Boolean),
      ),
    ];

    let userEmailMap = {};

    if (assignedUserIds.length > 0) {
      const { data: usersRows, error: usersError } = await scopedClient
        .from("users")
        .select("id, email")
        .in("id", assignedUserIds);

      if (usersError) {
        console.error("Error fetching user emails for tokens:", usersError);
        return NextResponse.json(
          { error: "Could not load token user details." },
          { status: 500 },
        );
      }

      userEmailMap = (usersRows || []).reduce((accumulator, row) => {
        accumulator[row.id] = row.email;
        return accumulator;
      }, {});
    }

    const tokens = (tokenRows || []).map((row) => {
      const status = isTokenExpired(row) ? "expired" : "active";

      return {
        id: row.id,
        genTime: row.created_at,
        expiry: row.expires_at,
        token: row.token,
        userEmail: userEmailMap[row.assigned_to] || "-",
        status,
        manualExpire: row.manual_expire === true,
      };
    });

    return NextResponse.json({ tokens }, { status: 200 });
  } catch (error) {
    console.error("Error in pic tokens GET API:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading PIC tokens." },
      { status: 500 },
    );
  }
}
