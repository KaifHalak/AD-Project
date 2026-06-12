import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  getAccessTokenFromHeader,
  getRequesterProfile,
} from "@/lib/bookingTokenAuth";

const EQUIPMENT_STATUS = {
  AVAILABLE: "available",
  MAINTENANCE: "maintenance",
  UNAVAILABLE: "unavailable",
};

async function requirePpmuRequester(request) {
  const accessToken = getAccessTokenFromHeader(request);

  if (!accessToken) {
    return {
      error: { status: 401, message: "Please log in before managing equipment." },
    };
  }

  const { requester, error } = await getRequesterProfile(
    accessToken,
    "Please log in before managing equipment.",
  );

  if (error) return { error };

  if (requester.role !== "ppmu") {
    return {
      error: { status: 403, message: "Only PPMU users can manage equipment." },
    };
  }

  return { requester };
}

function normalizeEquipmentStatus(value) {
  const status = String(value || "").trim().toLowerCase();

  if (status === EQUIPMENT_STATUS.MAINTENANCE) {
    return EQUIPMENT_STATUS.MAINTENANCE;
  }

  if (status === EQUIPMENT_STATUS.AVAILABLE) {
    return EQUIPMENT_STATUS.AVAILABLE;
  }

  if (status === EQUIPMENT_STATUS.UNAVAILABLE) {
    return EQUIPMENT_STATUS.UNAVAILABLE;
  }

  return "";
}

export async function GET(request) {
  try {
    const { error } = await requirePpmuRequester(request);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const admin = getSupabaseAdminClient();
    const [labsResult, equipmentResult] = await Promise.all([
      admin
        .from("labs")
        .select("id, name, description, location, status, course")
        .order("name", { ascending: true }),
      admin
        .from("equipment")
        .select(
          "id, name, description, location, status, price_per_hour, course, quantity, lab_id, staff_name, staff_email, staff_contact",
        )
        .order("name", { ascending: true }),
    ]);

    if (labsResult.error || equipmentResult.error) {
      console.error(
        "Error loading PPMU equipment catalog:",
        labsResult.error || equipmentResult.error,
      );
      return NextResponse.json(
        { error: "Could not load equipment catalog." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        labs: labsResult.data || [],
        equipment: equipmentResult.data || [],
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/ppmu/equipment:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading equipment." },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const { error } = await requirePpmuRequester(request);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const body = await request.json();
    const equipmentId = String(body?.equipmentId || "").trim();
    const pricePerHour = Number(body?.pricePerHour);
    const status = normalizeEquipmentStatus(body?.status);

    if (!equipmentId) {
      return NextResponse.json(
        { error: "Equipment ID is required." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(pricePerHour) || pricePerHour < 0) {
      return NextResponse.json(
        { error: "Price per hour must be a whole number of 0 or more." },
        { status: 400 },
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: "Status must be available, maintenance, or unavailable." },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
    const { data, error: updateError } = await admin
      .from("equipment")
      .update({
        price_per_hour: pricePerHour,
        status,
      })
      .eq("id", equipmentId)
      .select(
        "id, name, description, location, status, price_per_hour, course, quantity, lab_id, staff_name, staff_email, staff_contact",
      )
      .maybeSingle();

    if (updateError) {
      console.error("Error updating equipment:", updateError);
      return NextResponse.json(
        { error: "Could not update equipment." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Equipment was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ equipment: data }, { status: 200 });
  } catch (error) {
    console.error("Error in PATCH /api/ppmu/equipment:", error);
    return NextResponse.json(
      { error: "Something went wrong while updating equipment." },
      { status: 500 },
    );
  }
}
