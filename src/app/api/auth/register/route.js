import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";

const ALLOWED_ROLES = new Set(["student", "staff", "pic"]);
const REQUIRED_EMAIL_SUFFIX = "@graduate.utm.my";

function isEmailFormatValid(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAllowedEmailDomain(email) {
  return typeof email === "string" && email.endsWith(REQUIRED_EMAIL_SUFFIX);
}

function normalizeBody(body) {
  return {
    username: (body?.username || "").trim(),
    email: (body?.email || "").trim().toLowerCase(),
    password: body?.password || "",
    role: (body?.role || "").trim().toLowerCase(),
  };
}

function getRegistrationValidationError({ username, email, password, role }) {
  if (!username || !email || !password || !role) {
    return "Username, email, password, and role are required.";
  }

  if (username.length < 3) {
    return "Username must be at least 3 characters.";
  }

  if (!isEmailFormatValid(email)) {
    return "Please enter a valid email address.";
  }

  if (!isAllowedEmailDomain(email)) {
    return `Email must end with ${REQUIRED_EMAIL_SUFFIX}.`;
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!ALLOWED_ROLES.has(role)) {
    return "Role must be one of: student, staff, pic.";
  }

  return "";
}

export async function POST(request) {
  let createdAuthUserId = "";

  try {
    const body = await request.json();
    const registrationData = normalizeBody(body);
    const validationError = getRegistrationValidationError(registrationData);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { username, email, password, role } = registrationData;

    const supabaseAdmin = getSupabaseAdminClient();

    const { data: existingUserByEmail, error: existingEmailError } =
      await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (existingEmailError) {
      console.error(
        "Error checking existing users by email:",
        existingEmailError,
      );
      return NextResponse.json(
        { error: "Could not validate existing users." },
        { status: 500 },
      );
    }

    if (existingUserByEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const { data: authCreationData, error: authCreationError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          role,
        },
      });

    if (authCreationError || !authCreationData?.user?.id) {
      console.error("Error creating auth user:", authCreationError);
      return NextResponse.json(
        { error: authCreationError?.message || "Could not create auth user." },
        { status: 400 },
      );
    }

    createdAuthUserId = authCreationData.user.id;

    const { data: insertedUser, error: insertUserError } = await supabaseAdmin
      .from("users")
      .insert({
        username,
        email,
        role,
        verified: false,
        verification_expiry: null,
      })
      .select("id, username, email, role")
      .maybeSingle();

    if (insertUserError) {
      console.error("Error inserting users row:", insertUserError);

      // Roll back auth user to avoid orphan auth records if profile insert fails.
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);

      return NextResponse.json(
        { error: "Could not create user profile." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "Registration successful.",
        user: insertedUser || {
          username,
          email,
          role,
        },
        authUserId: createdAuthUserId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error during registration:", error);

    if (
      error instanceof Error &&
      error.message.includes("Missing Supabase admin environment variables")
    ) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (createdAuthUserId) {
      try {
        const supabaseAdmin = getSupabaseAdminClient();
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      } catch (rollbackError) {
        console.error("Error rolling back auth user:", rollbackError);
      }
    }

    return NextResponse.json(
      { error: "Something went wrong while registering." },
      { status: 500 },
    );
  }
}
