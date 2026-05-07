"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

export default function RequestDetailPage() {

  const { type, id } = useParams();
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [data, setData] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {

    // Determine booking table
    const table =
      type === "equipment"
        ? "equipment_bookings"
        : "lab_bookings";

    // Fetch booking
    const {
      data: bookingData,
      error,
    } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .single();

    if (error || !bookingData) {
      console.log(error);
      return;
    }

    // Fetch booking user
    const { data: user } =
      await supabase
        .from("users")
        .select("*")
        .eq(
          "id",
          bookingData.user_id
        )
        .single();

    // Fetch resource
    let resource = null;

    // Equipment
    if (type === "equipment") {

      const { data: equipment } =
        await supabase
          .from("equipment")
          .select("*")
          .eq(
            "id",
            bookingData.equipment_id
          );

      resource = equipment?.[0];

    } else {

      // Lab
      const { data: lab } =
        await supabase
          .from("labs")
          .select("*")
          .eq(
            "id",
            bookingData.lab_id
          );

      resource = lab?.[0];
    }

    // Fetch all unit leader process records
    const {
      data: processList,
      error: processError,
    } = await supabase
      .from("booking_process")
      .select("*")
      .eq("booking_type", type)
      .eq(
        "booking_id",
        Number(bookingData.id)
      )
      .eq(
        "reviewer_role",
        "unit_leader"
      );

    console.log(processList);
    console.log(processError);

    // Get latest process record
    const processData =
      processList
        ?.sort(
          (a, b) =>
            new Date(b.created_at) -
            new Date(a.created_at)
        )?.[0];

    // Fetch unit leader user
    let unitLeader = null;

    if (processData?.reviewer_id) {

      const { data: reviewer } =
        await supabase
          .from("users")
          .select("*")
          .eq(
            "id",
            processData.reviewer_id
          )
          .single();

      unitLeader = reviewer;
    }

    // Merge all data
    setData({
      ...bookingData,

      // Booking user
      user_name:
        user?.username || "Unknown",

      user_email:
        user?.email || "Unknown",

      user_role:
        user?.role || "Unknown",

      // Resource
      resource_name:
        resource?.name ||
        bookingData.equipment_id ||
        bookingData.lab_id ||
        "Unknown",

      // Unit leader review
      unit_leader_name:
        unitLeader?.username || "N/A",

      unit_leader_decision:
        processData?.decision ||
        "pending",

      unit_leader_date:
        processData?.decision_at ||
        null,

      unit_leader_remarks:
        processData?.remarks || "",
    });
  };

  if (!data) {
    return (
      <div className="p-10">
        Loading...
      </div>
    );
  }

  const handleApprove = async () => {

    // Final status logic
    let finalStatus = "pending";

    // If unit leader already approved
    if (
      data.unit_leader_decision ===
      "approved"
    ) {
      finalStatus = "approved";
    }

    // Determine booking table
    const table =
      type === "equipment"
        ? "equipment_bookings"
        : "lab_bookings";

    // Get current auth user
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return;

    // Get current system user
    const { data: currentUser } =
      await supabase
        .from("users")
        .select("*")
        .eq(
          "email",
          authUser.email
        )
        .single();

    // Insert booking process
    await supabase
      .from("booking_process")
      .insert({
        booking_type: type,

        booking_id: Number(id),

        reviewer_id:
          currentUser.id,

        reviewer_role: "ppmu",

        decision: "approved",

        remarks:
          "Approved by PPMU",
      });

    // Update booking table
    const { error } =
      await supabase
        .from(table)
        .update({
          ppmu_status: "Approved",
          status: finalStatus,
        })
        .eq("id", id);

    // Success
    if (!error) {

      // Dynamic popup message
      setPopupMessage(
        "Booking approved."
      );

      // Show popup
      setShowSuccess(true);

      // Redirect after 1.5s
      setTimeout(() => {

        router.push("/PPMU");

      }, 1500);
    }
  };

  const handleReject = async () => {

    // Any reject = rejected
    const finalStatus = "rejected";

    // Determine booking table
    const table =
      type === "equipment"
        ? "equipment_bookings"
        : "lab_bookings";

    // Get current auth user
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return;

    // Get current system user
    const { data: currentUser } =
      await supabase
        .from("users")
        .select("*")
        .eq(
          "email",
          authUser.email
        )
        .single();

    // Insert booking process
    await supabase
      .from("booking_process")
      .insert({
        booking_type: type,

        booking_id: Number(id),

        reviewer_id:
          currentUser.id,

        reviewer_role: "ppmu",

        decision: "rejected",

        remarks:
          "Rejected by PPMU",
      });

    // Update booking table
    const { error } =
      await supabase
        .from(table)
        .update({
          ppmu_status: "Rejected",
          status: finalStatus,
        })
        .eq("id", id);

    // Success
    if (!error) {

      // Dynamic popup message
      setPopupMessage(
        "Booking rejected."
      );

      // Show popup
      setShowSuccess(true);

      // Redirect after 1.5s
      setTimeout(() => {

        router.push("/PPMU");

      }, 1500);
    }
  };

  return (
    
    <div className="bg-[#f4efe9] min-h-screen p-8">
      {/* SUCCESS POPUP */}
      {showSuccess && (
        <div className="fixed top-6 right-6 z-50">
          <div className="bg-green-500 text-white px-6 py-4 rounded-2xl shadow-xl">
             {popupMessage}
          </div>
        </div>

      )}
     <div className="w-3/4 max-w-7xl mx-auto">
      {/* BACK + TITLE */}
      <div className="flex items-center gap-4 mb-6">

        <button
          onClick={() => router.back()}
          className="text-2xl cursor-pointer">
          ←
        </button>

        <h1 className="text-4xl font-bold">
          Request Details
        </h1>
      </div>

      <div className="space-y-6" >
        {/* REQUEST OVERVIEW */}
        <Section title="Request Overview">
          <Grid>
            <Field
              label="Request ID"
              value={data.id}/>

            <Field
              label="Request Type"
              value={type}/>
            <Field label="Current Status">
                <Badge
                text={data.status}
                type={
                    data.status === "approved"
                    ? "approved"
                    : data.status === "rejected"
                    ? "rejected"
                    : "pending"
                }
                />
            </Field>
            <Field
              label="Date Submitted"
              value={data.booking_date}/>
          </Grid>
        </Section>

        {/*User Information*/}
        <Section title="User Information">

        <div className="grid grid-cols-3 gap-6">

            <Field
            label="User Name"
            value={data.user_name}
            />

            <Field
            label="User Email"
            value={data.user_email}
            />

            <Field
            label="User Role"
            value={data.user_role}
            />

        </div>

        </Section>
                        
        {/* BOOKING INFO */}
        <Section title="Booking Information">
        <div className="space-y-10">
            {/* RESOURCE NAME */}
            <Field
            label={
                type === "lab"
                ? "Lab Name"
                : "Equipment Name"
            }
            value={data.resource_name}/>

            {/* START / END */}
            <div className="grid grid-cols-2 gap-10">
            <Field
                label="Start Date & Time"
                value={`${data.booking_date} ${data.start_time}`}/>
            <Field
                label="End Date & Time"
                value={`${data.booking_date} ${data.end_time}`}/>
            </div>

            {/* REASON */}
            <Field
            label="Reason for Booking"
              value={
                data.usage ||
                "No reason provided."
              }
            full/>
        </div>

        </Section>

        {/* UNIT LEADER */}
        <Section title="Unit Leader Review">

          <div className="grid grid-cols-3 gap-10">

            {/* DECISION */}
            <Field label="Unit Leader Decision">

              <Badge
                text={data.unit_leader_decision}
                type={
                  data.unit_leader_decision ===
                  "approved"
                    ? "approved"
                    : data.unit_leader_decision ===
                      "rejected"
                    ? "rejected"
                    : "pending"
                }
              />

            </Field>

            {/* NAME */}
            <Field
              label="Unit Leader Name"
              value={
                data.unit_leader_name || "N/A"
              }
            />

            {/* DATE */}
            <Field
              label="Decision Date"
              value={
                data.unit_leader_date
                  ? new Date(
                      data.unit_leader_date
                    ).toLocaleString()
                  : "N/A"
              }
            />

          </div>

        </Section>

        {/* DECISION PANEL */}
        <Section title="PPMU Decision Panel">
          <p className="text-sm text-gray-500 mb-4">
            MAKE FINAL DECISION
          </p>
          <div className="flex gap-4">
            <button
                onClick={handleApprove}
              className="flex-1 border border-green-500 text-green-600 py-4 rounded-xl text-lg font-medium cursor-pointer hover:bg-green-50 transition"
            >
              ✔ Approve
            </button>
            <button
                onClick={handleReject}
              className="flex-1 border border-red-500 text-red-500 py-4 rounded-xl text-lg font-medium cursor-pointer hover:bg-red-50 transition"
            >
              ✖ Reject
            </button>
          </div>
        </Section>

      </div>
     </div>
    </div>
  );
}

/* ---------- UI COMPONENTS ---------- */

function Section({ title, children }) {
  return (
    <div className="border border-border-light bg-[#fafafa] p-6 rounded-2xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4">
        {title}
      </h2>

      {children}
    </div>
  );
}

function Grid({ children }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  children,
  full,
}) {
  return (
    <div className={full ? "col-span-2" : ""}>

      <p className="text-xs text-gray-500 mb-1">
        {label?.toUpperCase()}
      </p>

      <div className="text-lg font-medium">
        {children ? children : value}
      </div>

    </div>
  );
}

function Badge({ text, type }) {

  const styles = {
    pending:
      "bg-yellow-100 text-yellow-600",

    approved:
      "bg-green-100 text-green-600",

    rejected:
      "bg-red-100 text-red-600",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-sm ${styles[type]}`}
    >
      {text}
    </span>
  );
}