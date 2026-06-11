"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { getCurrentSession } from "@/lib/supabase/auth";
import { formatRmFromUsd } from "@/lib/currency";

function formatTime(timeValue) {
  return timeValue ? String(timeValue).slice(0, 5) : "-";
}

function formatStudyLevel(value) {
  if (!value) return "-";
  return String(value).replaceAll("_", " ").replace(/^\w/, (char) => char.toUpperCase());
}

function formatDecision(process) {
  if (!process) return "Pending";
  return process.decision === "approved" ? "Approved" : "Rejected";
}

function statusClass(status) {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    default:
      return "bg-primary/10 text-primary";
  }
}

export default function UnitLeaderRequestDetailPage() {
  const { type, id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [remarksByItem, setRemarksByItem] = useState({});

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
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const responseData = await response.json();

      if (!response.ok) {
        setErrorMessage(responseData?.error || "Could not load request details.");
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

  async function handleDecision(itemId, decision) {
    setIsSubmitting(`${itemId}-${decision}`);
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
        body: JSON.stringify({
          itemId,
          decision,
          remarks: remarksByItem[itemId] || "",
        }),
      });
      const responseData = await response.json();

      if (!response.ok) {
        setErrorMessage(responseData?.error || "Could not save decision.");
        return;
      }

      await fetchData();
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while saving decision.");
    } finally {
      setIsSubmitting("");
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-background-main p-8">Loading...</div>;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background-main p-8">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage || "Request details could not be loaded."}
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background-main px-4 py-6 md:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div>
          <h1 className="text-3xl font-semibold text-text-main">
            Request #{data.id}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {data.user_name} | {data.user_email} | VOT {data.vot_number || "-"}
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-5">
          <DetailSection title="User Details">
            <Info label="User ID" value={data.requester_identifier || "-"} />
            <Info label="Faculty" value={data.requester_faculty || "-"} />
            <Info label="Contact" value={data.requester_contact || "-"} />
            <Info label="Study Level" value={formatStudyLevel(data.study_level)} />
          </DetailSection>

          <DetailSection title="Lecturer Details">
            <Info label="Lecturer Name" value={data.lect_name || "-"} />
            <Info label="Lecturer Email" value={data.lect_email || "-"} />
            <Info label="Lecturer Contact" value={data.lect_contact || "-"} />
          </DetailSection>

          <DetailSection title="Request Details">
            <Info label="Request Details" value={data.request_details || "-"} wide />
          </DetailSection>
        </div>

        <div className="space-y-5">
          {data.items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-border-light bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusClass(
                      item.unit_leader_process?.decision,
                    )}`}
                  >
                    Unit Leader: {formatDecision(item.unit_leader_process)}
                  </span>
                  <h2 className="mt-4 text-2xl font-semibold text-text-main">
                    {item.equipment_name}
                  </h2>
                  <p className="mt-2 flex items-center gap-2 text-sm text-text-muted">
                    <MapPin className="h-4 w-4" />
                    {item.lab_name} | {item.start_date} to {item.end_date} |{" "}
                    {formatTime(item.start_time)} - {formatTime(item.end_time)}
                  </p>
                </div>
                <p className="text-xl font-semibold text-primary">
                  {formatRmFromUsd(item.total_price || 0)}
                </p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Info label="Staff Name" value={item.staff_name || "-"} />
                <Info label="Staff Email" value={item.staff_email || "-"} />
                <Info label="Staff Contact" value={item.staff_contact || "-"} />
              </div>

              <div className="mt-5 rounded-xl border border-border-light bg-background-main p-4">
                <p className="text-sm font-semibold text-text-main">Reason</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">
                  {item.booking_reason || "No reason provided."}
                </p>
              </div>

              <div className="mt-5">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-text-main">
                    Unit Leader Remarks
                  </span>
                  <textarea
                    value={remarksByItem[item.id] || ""}
                    onChange={(event) =>
                      setRemarksByItem((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    disabled={!item.can_review}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border-light bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-primary disabled:opacity-60"
                    placeholder={item.unit_leader_process?.remarks || "Add remarks..."}
                  />
                </label>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleDecision(item.id, "approved")}
                    disabled={!item.can_review || Boolean(isSubmitting)}
                    className="flex-1 rounded-xl border border-green-400 px-4 py-3 font-semibold text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting === `${item.id}-approved` ? "Saving..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision(item.id, "rejected")}
                    disabled={!item.can_review || Boolean(isSubmitting)}
                    className="flex-1 rounded-xl border border-red-400 px-4 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting === `${item.id}-rejected` ? "Saving..." : "Reject"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function DetailSection({ title, children }) {
  return (
    <section className="rounded-2xl border border-border-light bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-primary">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">{children}</div>
    </section>
  );
}

function Info({ label, value, wide }) {
  return (
    <div
      className={`rounded-xl border border-border-light bg-background-main p-4 ${
        wide ? "md:col-span-3" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase text-text-muted">{label}</p>
      <p className="mt-1 break-words font-semibold text-text-main">{value}</p>
    </div>
  );
}
