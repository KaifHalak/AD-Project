"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCurrentSession } from "@/lib/supabase/auth";
import { formatRmFromUsd } from "@/lib/currency";

function formatTime(timeValue) {
  if (!timeValue) return "-";

  const [hours = "0", minutes = "0"] = String(timeValue).split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateTime(dateTimeValue) {
  if (!dateTimeValue) return "N/A";

  return new Date(dateTimeValue).toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPrice(value) {
  return value === null || value === undefined ? "-" : formatRmFromUsd(value);
}

export default function UnitLeaderRequestDetailPage() {
  const { type, id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [remarks, setRemarks] = useState("");

  const getAccessToken = useCallback(async () => {
    const { data: sessionData } = await getCurrentSession();
    return sessionData?.session?.access_token || "";
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const accessToken = await getAccessToken();

      setIsLoading(true);
      setErrorMessage("");

      if (!accessToken) {
        router.push("/");
        return;
      }

      const response = await fetch(`/api/unit-leader/${type}/${id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/");
          return;
        }

        setErrorMessage(
          responseData?.error || "Could not load request details.",
        );
        return;
      }

      setData(responseData.request);
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while loading request details.");
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, id, router, type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDecision = async (decision) => {
    if (!data?.can_review) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.push("/");
        return;
      }

      const response = await fetch(`/api/unit-leader/${type}/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ decision, remarks }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/");
          return;
        }

        setErrorMessage(responseData?.error || "Could not save decision.");
        return;
      }

      setPopupMessage(responseData?.message || "Decision saved.");
      setShowSuccess(true);

      setTimeout(() => {
        router.push("/unit-leader");
      }, 1500);
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while saving decision.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-10">Loading...</div>;
  }

  if (!data) {
    return (
      <div className="bg-[#f4efe9] min-h-screen p-8">
        <div className="w-3/4 max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="text-2xl cursor-pointer"
          >
            &larr;
          </button>
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage || "Request details could not be loaded."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f4efe9] min-h-screen p-8">
      {showSuccess && (
        <div className="fixed top-6 right-6 z-50">
          <div className="bg-green-500 text-white px-6 py-4 rounded-2xl shadow-xl">
            {popupMessage}
          </div>
        </div>
      )}

      <div className="w-3/4 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="text-2xl cursor-pointer"
          >
            &larr;
          </button>

          <h1 className="text-4xl font-bold">Request Details</h1>
        </div>

        {errorMessage ? (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mb-6 rounded-2xl border border-border-light bg-[#fafafa] p-5 text-sm text-gray-600 shadow-sm">
          <p className="font-semibold text-[#b0125b]">Review instructions</p>
          <p className="mt-2">
            Review the request details carefully before making a decision. If
            the request is approved, make sure the related grant and VOT details
            are checked so the finance side can deduct the required funds from
            the correct allocation.
          </p>
        </div>

        <div className="space-y-6">
          <Section title="Request Overview">
            <Grid>
              <Field label="Request ID" value={data.id} />
              <Field label="Request Type" value={data.type} />
              <Field label="Current Status">
                <Badge
                  text={data.status}
                  type={data.status_type || "pending"}
                />
              </Field>
              <Field label="Booking Date" value={data.booking_date} />
              <Field
                label="Request Made"
                value={formatDateTime(data.created_at)}
              />
            </Grid>
          </Section>

          <Section title="User Information">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <Field label="User Name" value={data.user_name} />
              <Field label="User Email" value={data.user_email} />
              <Field label="User Role" value={data.user_role} />
              <Field label="User ID" value={data.requester_identifier || "-"} />
              <Field label="Faculty" value={data.requester_faculty || "-"} />
              <Field
                label="Contact Number"
                value={data.requester_contact || "-"}
              />
            </div>
          </Section>

          <Section title="Booking Information">
            <div className="space-y-10">
              <Field
                label={type === "lab" ? "Lab Name" : "Equipment Name"}
                value={data.resource_name}
              />

              <div className="grid grid-cols-2 gap-10">
                <Field
                  label="Start Date & Time"
                  value={`${data.booking_date} ${formatTime(data.start_time)}`}
                />
                <Field
                  label="End Date & Time"
                  value={`${data.booking_date} ${formatTime(data.end_time)}`}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Field label="VOT Number" value={data.vot_number || "-"} />
                <Field
                  label="Request Price"
                  value={formatPrice(data.total_price)}
                />
              </div>

              <Field
                label="Reason for Booking"
                value={data.usage || "No reason provided."}
                full
              />
            </div>
          </Section>

          <Section title="Unit Leader Decision Panel">
            <p className="text-sm text-gray-500 mb-4">MAKE DECISION</p>

            {!data.can_review ? (
              <p className="mb-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Unit leader decision has already been submitted and cannot be
                changed.
              </p>
            ) : null}

            <div className="mb-5">
              <label
                htmlFor="unitLeaderRemarks"
                className="block text-xs text-gray-500 mb-1"
              >
                UNIT LEADER REMARKS
              </label>
              <textarea
                id="unitLeaderRemarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Add review remarks..."
                disabled={!data.can_review}
                rows={4}
                className="w-full resize-none rounded-xl border border-[#ddd6cc] bg-[#f3efe9] p-3 text-text-main outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
              />
              <p className="mt-2 text-xs text-gray-500">
                {data.can_review
                  ? 'Default if blank: "Approved by Unit Leader" when approving, or "Rejected by Unit Leader" when rejecting.'
                  : data.unit_leader_remarks || "No remarks provided."}
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => handleDecision("approved")}
                disabled={isSubmitting || !data.can_review}
                className="flex-1 border border-green-500 text-green-600 py-4 rounded-xl text-lg font-medium cursor-pointer hover:bg-green-50 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                &#10003; Approve
              </button>

              <button
                onClick={() => handleDecision("rejected")}
                disabled={isSubmitting || !data.can_review}
                className="flex-1 border border-red-500 text-red-500 py-4 rounded-xl text-lg font-medium cursor-pointer hover:bg-red-50 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                &#10005; Reject
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="border border-border-light bg-[#fafafa] p-6 rounded-2xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-2 gap-6">{children}</div>;
}

function Field({ label, value, children, full }) {
  return (
    <div className={`${full ? "col-span-2" : ""} min-w-0`}>
      <p className="text-xs text-gray-500 mb-1">{label?.toUpperCase()}</p>
      <div className="text-lg font-medium break-words">
        {children ? children : value}
      </div>
    </div>
  );
}

function Badge({ text, type }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-600",
    approved: "bg-green-100 text-green-600",
    rejected: "bg-red-100 text-red-600",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm ${styles[type]}`}>
      {text}
    </span>
  );
}
