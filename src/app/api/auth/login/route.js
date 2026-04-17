import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";

const REQUIRED_EMAIL_SUFFIX = "@graduate.utm.my";

/**
 * Handles login requests using email and password only.
 * Returns a simple JSON response with either session data or an error.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const email = (body?.email || "").trim().toLowerCase();
    const password = body?.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    if (!email.endsWith(REQUIRED_EMAIL_SUFFIX)) {
      return NextResponse.json(
        { error: `Email must end with ${REQUIRED_EMAIL_SUFFIX}.` },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        message: "Login successful.",
        user: data.user,
        session: data.session,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error during login:", error);
    return NextResponse.json(
      { error: "Something went wrong while logging in." },
      { status: 500 },
    );
  }
}
