"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import { getCurrentSession } from "@/lib/supabase/auth";
import { formatRm } from "@/lib/currency";
import { deriveOverallStatus, getDisplayStatus } from "@/lib/bookingRequest";

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeValue) {
  return timeValue ? String(timeValue).slice(0, 5) : "-";
}

function formatStudyLevel(value) {
  if (!value) return "-";
  return String(value).replaceAll("_", " ").replace(/^\w/, (char) => char.toUpperCase());
}

function formatDecision(process) {
  if (!process) return "Pending";
  return process.decision === "approved" ? "Recommended" : "Rejected";
}

function statusClass(status) {
  switch (status) {
    case "pending_unit_leader_process":
      return "border-primary/20 bg-primary/10 text-primary";
    case "pending_ppmu_process":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "processed":
    case "approved":
      return "border-green-200 bg-green-50 text-green-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    case "cancelled":
      return "border-border-light bg-background-main text-text-muted";
    case "partially_approved":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-primary/20 bg-primary/10 text-primary";
  }
}

function itemCardClass(item) {
  switch (item.unit_leader_process?.decision) {
    case "approved":
      return "border-green-200 bg-green-50/70";
    case "rejected":
      return "border-red-200 bg-red-50/70";
    default:
      return "border-border-light bg-white";
  }
}

function getUnitLeaderItemStatus(decision) {
  return decision === "approved" ? "under_ppmu_review" : "rejected";
}

function getOriginalTotal(items) {
  return (items || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0);
}

function getUnitLeaderAdjustedTotal(items) {
  return (items || []).reduce((sum, item) => {
    if (item.unit_leader_process?.decision === "rejected") return sum;
    if (item.status === "rejected") return sum;
    return sum + Number(item.total_price || 0);
  }, 0);
}

function getDecisionVerb(decision) {
  return decision === "approved" ? "recommend" : "reject";
}

function getConfirmationTitle(action) {
  const verb = getDecisionVerb(action.decision);

  if (action.mode === "bulk") {
    return `${verb.charAt(0).toUpperCase()}${verb.slice(1)} all items?`;
  }

  return `${verb.charAt(0).toUpperCase()}${verb.slice(1)} this item?`;
}

function getConfirmationMessage(action) {
  const verb = getDecisionVerb(action.decision);

  if (action.mode === "bulk") {
    return `Are you sure you want to ${verb} all ${action.count} available equipment item${
      action.count === 1 ? "" : "s"
    }?`;
  }

  return `Are you sure you want to ${verb} ${action.itemName}?`;
}

function getConfirmationActionLabel(action) {
  const verb = getDecisionVerb(action.decision);

  if (action.mode === "bulk") {
    return `${verb.charAt(0).toUpperCase()}${verb.slice(1)} All`;
  }

  return verb.charAt(0).toUpperCase() + verb.slice(1);
}

async function readResponseJson(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return {};
}

export default function UnitLeaderRequestDetailPage() {
  const { type, id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [bulkRemarks, setBulkRemarks] = useState("");
  const [remarksByItem, setRemarksByItem] = useState({});
  const [pendingDecision, setPendingDecision] = useState(null);

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
      const responseData = await readResponseJson(response);

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

  function updateItemDecision(itemId, decision, processRecord) {
    setData((current) => {
      if (!current) return current;

      const nextItems = (current.items || []).map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: getUnitLeaderItemStatus(decision),
              unit_leader_process: processRecord,
              can_review: false,
            }
          : item,
      );
      const nextStatus = deriveOverallStatus(nextItems);

      return {
        ...current,
        items: nextItems,
        display_status: getDisplayStatus(nextStatus),
        display_status_type: nextStatus,
      };
    });
  }

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
      const responseData = await readResponseJson(response);

      if (!response.ok) {
        setErrorMessage(responseData?.error || "Could not save decision.");
        return;
      }

      updateItemDecision(itemId, decision, responseData.process);
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while saving decision.");
    } finally {
      setIsSubmitting("");
    }
  }

  async function handleBulkDecision(decision) {
    const reviewableItems = (data?.items || []).filter((item) => item.can_review);

    if (reviewableItems.length === 0) {
      setErrorMessage("There are no equipment items available for review.");
      return;
    }

    setIsSubmitting(`bulk-${decision}`);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.push("/");
        return;
      }

      for (const item of reviewableItems) {
        const response = await fetch(`/api/unit-leader/${type}/${id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            itemId: item.id,
            decision,
            remarks: bulkRemarks,
          }),
        });
        const responseData = await readResponseJson(response);

        if (!response.ok) {
          setErrorMessage(
            responseData?.error || "Could not save all decisions.",
          );
          return;
        }

        updateItemDecision(item.id, decision, responseData.process);
      }

      setBulkRemarks("");
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while saving all decisions.");
    } finally {
      setIsSubmitting("");
    }
  }

  function requestBulkDecision(decision) {
    const reviewableItems = (data?.items || []).filter((item) => item.can_review);

    if (reviewableItems.length === 0) {
      setErrorMessage("There are no equipment items available for review.");
      return;
    }

    setPendingDecision({
      mode: "bulk",
      decision,
      count: reviewableItems.length,
    });
  }

  function requestItemDecision(item, decision) {
    if (!item.can_review) return;

    setPendingDecision({
      mode: "item",
      decision,
      itemId: item.id,
      itemName: item.equipment_name || item.equipment_id || "this item",
    });
  }

  function confirmPendingDecision() {
    const action = pendingDecision;
    setPendingDecision(null);

    if (!action) return;

    if (action.mode === "bulk") {
      handleBulkDecision(action.decision);
      return;
    }

    handleDecision(action.itemId, action.decision);
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

  const reviewableItems = data.items.filter((item) => item.can_review);
  const reviewableCount = reviewableItems.length;
  const originalTotal = getOriginalTotal(data.items);
  const adjustedTotal = getUnitLeaderAdjustedTotal(data.items);

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

        <div className="rounded-2xl border border-border-light bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="rounded-full border border-border-light bg-background-main px-3 py-1 text-xs font-semibold uppercase text-text-muted">
                Request #{data.id}
              </span>
              <span
                className={`ml-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusClass(
                  data.display_status_type,
                )}`}
              >
                {data.display_status || "-"}
              </span>
              <h1 className="mt-4 text-3xl font-semibold text-text-main">
                {data.item_count} equipment item
                {data.item_count === 1 ? "" : "s"}
              </h1>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm text-text-muted">Total</p>
              <p className="text-3xl font-semibold text-primary">
                {formatRm(adjustedTotal)}
              </p>
              <p className="mt-1 text-xs font-semibold text-text-muted">
                Original total: {formatRm(originalTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <DetailSection title="User Details">
            <Info label="Username" value={data.user_name || "-"} />
            <Info label="Role" value={data.user_role || "-"} />
            <Info label="Email" value={data.user_email || "-"} />
            <Info label="User ID" value={data.requester_identifier || "-"} />
            <Info label="Faculty" value={data.requester_faculty || "-"} />
            <Info label="Contact" value={data.requester_contact || "-"} />
            <Info label="Study Level" value={formatStudyLevel(data.study_level)} />
          </DetailSection>

          <DetailSection title="Lecturer Details">
            <Info label="Lecturer Name" value={data.lect_name || "-"} />
            <Info label="Lecturer Email" value={data.lect_email || "-"} />
            <Info label="Lecturer Contact" value={data.lect_contact || "-"} />
            <Info label="Faculty" value={data.lect_faculty || "-"} />
            <Info label="ID Number" value={data.lect_id || "-"} />
            <Info label="VOT Number" value={data.vot_number || "-"} />
          </DetailSection>

          <DetailSection title="PIC Details">
            <Info label="PIC Token" value={data.pic_token || "-"} />
            <Info label="PIC Name" value={data.pic_name || "-"} />
            <Info label="PIC Email" value={data.pic_email || "-"} />
          </DetailSection>

          <DetailSection title="Request Details">
            <Info label="Request Details" value={data.request_details || "-"} wide />
          </DetailSection>
        </div>

        <section className="rounded-2xl border border-border-light bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase text-primary">
                Bulk Review
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                {reviewableCount} equipment item
                {reviewableCount === 1 ? "" : "s"} available for review.
              </p>
            </div>
            <div className="flex gap-3 lg:min-w-80">
              <button
                type="button"
                onClick={() => requestBulkDecision("approved")}
                disabled={reviewableCount === 0 || Boolean(isSubmitting)}
                className="flex-1 rounded-xl border border-green-400 px-4 py-3 font-semibold text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting === "bulk-approved" ? "Saving..." : "Recommend All"}
              </button>
              <button
                type="button"
                onClick={() => requestBulkDecision("rejected")}
                disabled={reviewableCount === 0 || Boolean(isSubmitting)}
                className="flex-1 rounded-xl border border-red-400 px-4 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting === "bulk-rejected" ? "Saving..." : "Reject All"}
              </button>
            </div>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-sm font-semibold text-text-main">
              Remarks for All
            </span>
            <textarea
              value={bulkRemarks}
              onChange={(event) => setBulkRemarks(event.target.value)}
              disabled={reviewableCount === 0 || Boolean(isSubmitting)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border-light bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-primary disabled:opacity-60"
              placeholder="These remarks will be applied to every reviewed equipment item."
            />
          </label>

          {errorMessage ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </section>

        <div className="space-y-5">
          {data.items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-6 shadow-sm ${itemCardClass(item)}`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusClass(
                        item.status,
                      )}`}
                    >
                      {item.status?.replaceAll("_", " ") || "pending"}
                    </span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary">
                      {item.equipment_id}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-text-main">
                    {item.equipment_name}
                  </h2>
                </div>
                <p className="text-xl font-semibold text-primary">
                  {formatRm(item.total_price || 0)}
                </p>
              </div>

              <div className="mt-6 space-y-6 border-t border-border-light pt-6">
                <ItemBlock title="Booking Details">
                  <ItemInfo label="Lab" value={item.lab_name || "-"} />
                  <ItemInfo label="Start Date" value={formatDate(item.start_date)} />
                  <ItemInfo label="End Date" value={formatDate(item.end_date)} />
                  <ItemInfo label="Start Time" value={formatTime(item.start_time)} />
                  <ItemInfo label="End Time" value={formatTime(item.end_time)} />
                </ItemBlock>

                <ItemBlock title="Staff Details">
                  <ItemInfo label="Name" value={item.staff_name || "-"} />
                  <ItemInfo label="Email" value={item.staff_email || "-"} />
                  <ItemInfo label="Contact" value={item.staff_contact || "-"} />
                </ItemBlock>

                <div>
                  <h3 className="text-xs font-semibold uppercase text-primary">
                    Additional Information
                  </h3>
                  <div className="mt-3 rounded-xl bg-background-main p-4">
                    <p className="text-xs font-semibold uppercase text-text-muted">
                      Reason
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-text-main">
                      {item.booking_reason || "No reason provided."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ReviewCard
                    title="Unit Leader Recommendation"
                    decision={formatDecision(item.unit_leader_process)}
                    process={item.unit_leader_process}
                  />
                  <ReviewCard
                    title="PPMU Review"
                    decision={formatDecision(item.ppmu_process)}
                    process={item.ppmu_process}
                  />
                </div>

                <div>
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
                      onClick={() => requestItemDecision(item, "approved")}
                      disabled={!item.can_review || Boolean(isSubmitting)}
                      className="flex-1 rounded-xl border border-green-400 px-4 py-3 font-semibold text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting === `${item.id}-approved` ? "Saving..." : "Recommend"}
                    </button>
                    <button
                      type="button"
                      onClick={() => requestItemDecision(item, "rejected")}
                      disabled={!item.can_review || Boolean(isSubmitting)}
                      className="flex-1 rounded-xl border border-red-400 px-4 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting === `${item.id}-rejected` ? "Saving..." : "Reject"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {pendingDecision ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border-light bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-text-main">
              {getConfirmationTitle(pendingDecision)}
            </h2>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              {getConfirmationMessage(pendingDecision)}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDecision(null)}
                className="rounded-xl border border-border-light px-4 py-2 font-semibold text-text-muted hover:bg-background-main"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPendingDecision}
                className={`rounded-xl px-4 py-2 font-semibold text-white ${
                  pendingDecision.decision === "approved"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {getConfirmationActionLabel(pendingDecision)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

function ItemBlock({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-primary">{title}</h3>
      <div className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function ItemInfo({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-text-main">
        {value}
      </p>
    </div>
  );
}

function ReviewCard({ title, decision, process }) {
  return (
    <div className="rounded-xl border border-border-light bg-background-main p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-text-main">
        <UserRound className="h-4 w-4 text-primary" />
        {title}
      </p>
      <p className="mt-2 text-sm font-semibold text-primary">{decision}</p>
      <p className="mt-1 text-sm text-text-muted">
        {process?.remarks || process?.rejection_reason || "No remarks yet."}
      </p>
    </div>
  );
}
