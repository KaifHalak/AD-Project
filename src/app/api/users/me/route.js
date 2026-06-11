import { NextResponse } from "next/server";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";

export async function GET(request) {
  try {
    const accessToken = getAccessTokenFromHeader(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Missing access token." },
        { status: 401 },
      );
    }

    const { requester, error } = await getRequesterProfile(
      accessToken,
      "Unauthorized. Please log in again.",
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        user: {
          username: requester.username || "",
          role: requester.role || "",
          email: requester.email || "",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/users/me:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading user details." },
      { status: 500 },
    );
  }
}
