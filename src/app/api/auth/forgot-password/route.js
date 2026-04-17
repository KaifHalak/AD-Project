import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/supabaseServer";

const REQUIRED_EMAIL_SUFFIX = "@graduate.utm.my";

function isEmailFormatValid(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = (body?.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 },
      );
    }

    if (!isEmailFormatValid(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
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
    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const redirectTo = `${origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("Error sending password reset email:", error);
      return NextResponse.json(
        { error: "Could not send reset email right now." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message:
          "If an account exists for this email, a password reset email has been sent.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in forgot-password API:", error);
    return NextResponse.json(
      { error: "Something went wrong while sending reset email." },
      { status: 500 },
    );
  }
}
