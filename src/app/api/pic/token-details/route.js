import { NextResponse } from "next/server";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
  verifyPicToken,
} from "@/lib/bookingTokenAuth";

export async function POST(request) {
  try {
    const accessToken = getAccessTokenFromHeader(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Please log in before checking this PIC token." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const picCode = String(body?.picCode || "").trim().toUpperCase();
    const { requester, scopedClient, error: requesterError } =
      await getRequesterProfile(
        accessToken,
        "Please log in before checking this PIC token.",
      );

    if (requesterError) {
      return NextResponse.json(
        { error: requesterError.message },
        { status: requesterError.status },
      );
    }

    const tokenVerification = await verifyPicToken({
      scopedClient,
      requester,
      picCode,
      persistVerification: false,
    });

    if (tokenVerification.error) {
      return NextResponse.json(
        { error: tokenVerification.error.message },
        { status: tokenVerification.error.status },
      );
    }

    return NextResponse.json({ pic: tokenVerification.pic }, { status: 200 });
  } catch (error) {
    console.error("Error in PIC token details API:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading PIC details." },
      { status: 500 },
    );
  }
}
