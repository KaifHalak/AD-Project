import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";

export function getAccessTokenFromHeader(request) {
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

export async function getRequesterProfile(
  accessToken,
  unauthenticatedMessage = "Please log in before booking.",
) {
  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);

  if (authError || !authData?.user?.email) {
    return {
      error: {
        status: 401,
        message: unauthenticatedMessage,
      },
    };
  }

  const scopedClient = getSupabaseServerClient(accessToken);
  const { data: requester, error: requesterError } = await scopedClient
    .from("users")
    .select("id, username, email, role")
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

export async function verifyPicToken({
  scopedClient,
  requester,
  picCode,
  persistVerification = true,
}) {
  if (requester.role === "pic") {
    return {
      verified: true,
      pic: {
        token: "",
        name: requester.username || "",
        email: requester.email || "",
      },
    };
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
    .select(
      "id, token, expires_at, manual_expire, assigned_to, assigned_by, created_at",
    )
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

    if (persistVerification) {
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
    }

    const admin = getSupabaseAdminClient();
    const { data: picUser, error: picUserError } = await admin
      .from("users")
      .select("id, username, email")
      .eq("id", assignedToken.assigned_by)
      .maybeSingle();

    if (picUserError) {
      console.error("Error loading PIC user details:", picUserError);
      return {
        error: {
          status: 500,
          message: "Code valid, but could not load PIC details.",
        },
      };
    }

    return {
      verified: true,
      pic: {
        token: assignedToken.token,
        name: picUser?.username || "",
        email: picUser?.email || "",
      },
    };
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
