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
  return String(value)
    .replaceAll("_", " ")
    .replace(/^\w/, (char) => char.toUpperCase());
}

function formatDecision(process) {
  if (!process) return "Pending";
  return process.decision === "approved" ? "Approved" : "Rejected";
}

function formatUnitLeaderDecision(process) {
  if (!process) return "Pending";
  return process.decision === "approved" ? "Recommended" : "Rejected";
}

function formatPpmuDecision(item) {
  if (item.unit_leader_process?.decision === "rejected" && !item.ppmu_process) {
    return "Rejected (by Unit Leader)";
  }

  return formatDecision(item.ppmu_process);
}

function statusClass(status) {
  switch (status) {
    case "pending_unit_leader_process":
      return "border-primary/20 bg-primary/10 text-primary";
    case "pending_ppmu_process":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "processed":
    case "approved":
      return "border-green-400 bg-green-100 text-green-800";
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
  if (item.unit_leader_process?.decision === "rejected") {
    return "border-red-200 bg-red-50/70";
  }

  if (
    item.unit_leader_process?.decision === "approved" &&
    item.ppmu_process?.decision === "approved"
  ) {
    return "border-green-400 bg-green-100/80";
  }

  switch (item.ppmu_process?.decision) {
    case "approved":
      return "border-green-300 bg-green-50";
    case "rejected":
      return "border-red-200 bg-red-50/70";
    default:
      return "border-border-light bg-white";
  }
}

function reviewDecisionClass(process) {
  switch (process?.decision) {
    case "approved":
      return "text-green-800";
    case "rejected":
      return "text-red-700";
    default:
      return "text-primary";
  }
}

function getEffectiveFinalPrice(item) {
  if (item?.status === "rejected") return 0;
  return Number(item?.new_total_price ?? item?.total_price ?? 0);
}

function getEffectiveFinalTotal(items) {
  return (items || []).reduce(
    (sum, item) => sum + getEffectiveFinalPrice(item),
    0,
  );
}

async function readResponseJson(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return {};
}

export default function PpmuRequestDetailPage() {
  const { type, id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [bulkRemarks, setBulkRemarks] = useState("");
  const [remarksByItem, setRemarksByItem] = useState({});
  const [pendingApproval, setPendingApproval] = useState(null);
  const [pendingRejection, setPendingRejection] = useState(null);
  const [editingPriceItemId, setEditingPriceItemId] = useState(null);
  const [priceByItem, setPriceByItem] = useState({});
  const [savingPriceItemId, setSavingPriceItemId] = useState(null);

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

      const response = await fetch(`/api/ppmu/${type}/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const responseData = await readResponseJson(response);

      if (!response.ok) {
        setErrorMessage(
          responseData?.error || "Could not load request details.",
        );
        return;
      }

      console.dir(responseData.request);
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
              status: decision,
              new_total_price:
                decision === "approved"
                  ? (item.new_total_price ?? item.total_price ?? 0)
                  : 0,
              ppmu_process: processRecord,
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
        total_price: getEffectiveFinalTotal(nextItems),
      };
    });
  }

  function startEditingPrice(item) {
    console.dir(item);
    setEditingPriceItemId(item.id);
    setPriceByItem((current) => ({
      ...current,
      [item.id]: String(item.new_total_price ?? item.total_price ?? 0),
    }));
  }

  function cancelEditingPrice() {
    setEditingPriceItemId(null);
  }

  async function saveFinalPrice(item) {
    const value = Number(priceByItem[item.id]);

    if (!Number.isInteger(value) || value < 0) {
      setErrorMessage("Final price must be a whole number of RM 0 or more.");
      return;
    }

    setSavingPriceItemId(item.id);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.push("/");
        return;
      }

      const response = await fetch(`/api/ppmu/${type}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          itemId: item.id,
          newTotalPrice: value,
        }),
      });
      const responseData = await readResponseJson(response);

      if (!response.ok) {
        setErrorMessage(responseData?.error || "Could not update final price.");
        return;
      }

      setData((current) => {
        if (!current) return current;

        const nextItems = (current.items || []).map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, new_total_price: value }
            : currentItem,
        );

        return {
          ...current,
          items: nextItems,
          total_price: getEffectiveFinalTotal(nextItems),
        };
      });
      setEditingPriceItemId(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while updating final price.");
    } finally {
      setSavingPriceItemId(null);
    }
  }

  function requestDecision(item, decision) {
    if (decision === "approved") {
      setPendingApproval({ type: "single", itemId: item.id, decision });
      return;
    }

    setPendingRejection({
      type: "single",
      itemId: item.id,
      itemName: item.equipment_name || item.equipment_id || "this item",
      decision,
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

      const response = await fetch(`/api/ppmu/${type}/${id}`, {
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

  function requestBulkDecision(decision) {
    const reviewableItems = (data?.items || []).filter(
      (item) => item.can_review,
    );

    if (reviewableItems.length === 0) {
      setErrorMessage("There are no equipment items available for review.");
      return;
    }

    if (decision === "approved") {
      setPendingApproval({ type: "bulk", decision });
      return;
    }

    setPendingRejection({
      type: "bulk",
      count: reviewableItems.length,
      decision,
    });
  }

  async function handleBulkDecision(decision) {
    const reviewableItems = (data?.items || []).filter(
      (item) => item.can_review,
    );

    setIsSubmitting(`bulk-${decision}`);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.push("/");
        return;
      }

      for (const item of reviewableItems) {
        const response = await fetch(`/api/ppmu/${type}/${id}`, {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-main p-8">Loading...</div>
    );
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

  async function confirmPendingApproval() {
    const action = pendingApproval;
    setPendingApproval(null);

    if (action?.type === "single") {
      await handleDecision(action.itemId, action.decision);
      return;
    }

    if (action?.type === "bulk") {
      await handleBulkDecision(action.decision);
    }
  }

  async function confirmPendingRejection() {
    const action = pendingRejection;
    setPendingRejection(null);

    if (action?.type === "single") {
      await handleDecision(action.itemId, action.decision);
      return;
    }

    if (action?.type === "bulk") {
      await handleBulkDecision(action.decision);
    }
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
                {formatRm(getEffectiveFinalTotal(data.items || []))}
              </p>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-5">
          <DetailSection title="User Details">
            <Info label="Username" value={data.user_name || "-"} />
            <Info label="Role" value={data.user_role || "-"} />
            <Info label="Email" value={data.user_email || "-"} />
            <Info label="User ID" value={data.requester_identifier || "-"} />
            <Info label="Faculty" value={data.requester_faculty || "-"} />
            <Info label="Contact" value={data.requester_contact || "-"} />
            <Info
              label="Study Level"
              value={formatStudyLevel(data.study_level)}
            />
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
            <Info
              label="Request Details"
              value={data.request_details || "-"}
              wide
            />
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
                {isSubmitting === "bulk-approved" ? "Saving..." : "Approve All"}
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
                <div className="text-left lg:text-right">
                  <p className="text-xl font-semibold text-primary">
                    {formatRm(getEffectiveFinalPrice(item))}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-text-muted">
                    Estimated: {formatRm(item.total_price || 0)}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-6 border-t border-border-light pt-6">
                <ItemBlock title="Booking Details">
                  <ItemInfo label="Lab" value={item.lab_name || "-"} />
                  <ItemInfo
                    label="Start Date"
                    value={formatDate(item.start_date)}
                  />
                  <ItemInfo
                    label="End Date"
                    value={formatDate(item.end_date)}
                  />
                  <ItemInfo
                    label="Start Time"
                    value={formatTime(item.start_time)}
                  />
                  <ItemInfo
                    label="End Time"
                    value={formatTime(item.end_time)}
                  />
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
                  <div className="mt-3 rounded-xl bg-background-main p-4">
                    <p className="text-xs font-semibold uppercase text-text-muted">
                      Unit Leader
                    </p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <ItemInfo
                        label="Name"
                        value={item.unit_leader_name || "-"}
                      />
                      <ItemInfo
                        label="Email"
                        value={item.unit_leader_email || "-"}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ReviewCard
                    title="Unit Leader Recommendation"
                    decision={formatUnitLeaderDecision(
                      item.unit_leader_process,
                    )}
                    process={item.unit_leader_process}
                  />
                  <ReviewCard
                    title="PPMU Review"
                    decision={formatPpmuDecision(item)}
                    process={item.ppmu_process}
                  />
                </div>

                <div>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-text-main">
                      PPMU Remarks
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
                      placeholder={
                        item.ppmu_process?.remarks || "Add remarks..."
                      }
                    />
                  </label>

                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase text-text-muted">
                          Final Price
                        </p>
                        {editingPriceItemId === item.id ? (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm font-semibold text-text-main">
                              RM
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={priceByItem[item.id] ?? ""}
                              onChange={(event) =>
                                setPriceByItem((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              className="w-36 rounded-lg border border-border-light bg-white px-3 py-2 text-lg font-semibold text-text-main outline-none focus:border-primary"
                            />
                          </div>
                        ) : (
                          <p className="mt-1 text-2xl font-bold text-primary">
                            {formatRm(getEffectiveFinalPrice(item))}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-text-muted">
                          Estimated: {formatRm(item.total_price || 0)}
                        </p>
                      </div>
                      {editingPriceItemId === item.id ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={cancelEditingPrice}
                            disabled={savingPriceItemId === item.id}
                            className="rounded-xl border border-border-light px-4 py-2 text-sm font-semibold text-text-main hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveFinalPrice(item)}
                            disabled={savingPriceItemId === item.id}
                            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingPriceItemId === item.id
                              ? "Saving..."
                              : "Save"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditingPrice(item)}
                          disabled={!item.can_review || Boolean(isSubmitting)}
                          className="rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => requestDecision(item, "approved")}
                      disabled={!item.can_review || Boolean(isSubmitting)}
                      className="flex-1 rounded-xl border border-green-400 px-4 py-3 font-semibold text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting === `${item.id}-approved`
                        ? "Saving..."
                        : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDecision(item, "rejected")}
                      disabled={!item.can_review || Boolean(isSubmitting)}
                      className="flex-1 rounded-xl border border-red-400 px-4 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting === `${item.id}-rejected`
                        ? "Saving..."
                        : "Reject"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      {pendingApproval ? (
        <ApprovalReminderModal
          isBulk={pendingApproval.type === "bulk"}
          onCancel={() => setPendingApproval(null)}
          onConfirm={confirmPendingApproval}
        />
      ) : null}
      {pendingRejection ? (
        <RejectionConfirmModal
          action={pendingRejection}
          onCancel={() => setPendingRejection(null)}
          onConfirm={confirmPendingRejection}
        />
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
      <p
        className={`mt-2 text-sm font-semibold ${reviewDecisionClass(process)}`}
      >
        {decision}
      </p>
      <p className="mt-1 text-sm text-text-muted">
        {process?.remarks || process?.rejection_reason || "No remarks yet."}
      </p>
    </div>
  );
}

function ApprovalReminderModal({ isBulk, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border-light bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-text-main">
          Confirm Approval
        </h2>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Before approving, make sure the payment has been manually deducted in
          the UTM finance system and the final price is correct.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border-light px-4 py-3 font-semibold text-text-main hover:bg-background-main"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl border border-green-500 bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700"
          >
            {isBulk ? "Confirm Approve All" : "Confirm Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectionConfirmModal({ action, onCancel, onConfirm }) {
  const isBulk = action.type === "bulk";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border-light bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-text-main">
          {isBulk ? "Reject all items?" : "Reject this item?"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          {isBulk
            ? `Are you sure you want to reject all ${action.count} available equipment item${
                action.count === 1 ? "" : "s"
              }?`
            : `Are you sure you want to reject ${action.itemName}?`}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border-light px-4 py-3 font-semibold text-text-main hover:bg-background-main"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl border border-red-500 bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700"
          >
            {isBulk ? "Confirm Reject All" : "Confirm Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
