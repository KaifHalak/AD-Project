"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";
import { formatRm } from "@/lib/currency";
import { downloadQuotationPdf } from "@/lib/quotationPdf";
import { downloadBookingReceiptPdf } from "@/lib/bookingReceiptPdf";

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeString) {
  return timeString ? String(timeString).slice(0, 5) : "-";
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
      return "bg-primary/10 text-primary border-primary/20";
    case "pending_ppmu_process":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "processed":
    case "approved":
      return "bg-green-50 text-green-700 border-green-200";
    case "rejected":
      return "bg-red-50 text-red-700 border-red-200";
    case "cancelled":
      return "bg-background-main text-text-muted border-border-light";
    case "partially_approved":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-primary/10 text-primary border-primary/20";
  }
}

function reviewCardClass(process) {
  switch (process?.decision) {
    case "approved":
      return "border-green-200 bg-green-50";
    case "rejected":
      return "border-red-200 bg-red-50";
    default:
      return "border-border-light bg-background-main";
  }
}

function reviewDecisionClass(process) {
  switch (process?.decision) {
    case "approved":
      return "text-green-700";
    case "rejected":
      return "text-red-700";
    default:
      return "text-primary";
  }
}

function isProcessedBooking(booking) {
  return (
    booking?.display_status_type === "processed" ||
    booking?.display_status === "Processed"
  );
}

function canDownloadReceipt(booking) {
  return booking?.display_status_type !== "cancelled";
}

function getItemEstimatedTotal(item) {
  return Number(item?.total_price || 0);
}

function getItemFinalTotal(item) {
  if (item?.status === "rejected") return 0;
  return Number(item?.new_total_price ?? item?.total_price ?? 0);
}

function getBookingEstimatedTotal(booking) {
  if (!Array.isArray(booking?.items)) {
    return Number(booking?.estimated_total_price ?? booking?.total_price ?? 0);
  }

  return booking.items.reduce((sum, item) => sum + getItemEstimatedTotal(item), 0);
}

function getBookingFinalTotal(booking) {
  if (booking?.display_status_type === "processed") {
    return Number(booking?.total_price || 0);
  }

  if (!Array.isArray(booking?.items)) {
    return Number(booking?.total_price || 0);
  }

  return booking.items.reduce((sum, item) => sum + getItemFinalTotal(item), 0);
}

export default function BookingRecordDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDownloadingQuotation, setIsDownloadingQuotation] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

  const fetchBooking = useCallback(
    async (token) => {
      const response = await fetch(`/api/bookings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Could not load booking details.");
        return;
      }

      setBooking(data.booking);
    },
    [id],
  );

  useEffect(() => {
    let isMounted = true;

    async function init() {
      setIsLoading(true);
      const { data: sessionData } = await getCurrentSession();

      if (!isMounted) return;

      if (!sessionData?.session) {
        router.push("/");
        return;
      }

      const token = sessionData.session.access_token;
      setAccessToken(token);
      await fetchBooking(token);
      setIsLoading(false);
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [fetchBooking, router]);

  async function handleCancel() {
    setIsCancelling(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Could not cancel booking.");
        return;
      }

      await fetchBooking(accessToken);
    } catch {
      setErrorMessage("Something went wrong while cancelling this booking.");
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleDownloadQuotation() {
    setIsDownloadingQuotation(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/bookings/${id}/quotation`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Could not prepare quotation.");
        return;
      }

      const quotationPayload = data.quotation?.quotation_payload || {};
      downloadQuotationPdf({
        ...quotationPayload,
        studentStatus: quotationPayload.studentStatus || booking?.study_level,
        lecturerName: quotationPayload.lecturerName || booking?.lect_name,
        lecturerEmail: quotationPayload.lecturerEmail || booking?.lect_email,
        lecturerContact: quotationPayload.lecturerContact || booking?.lect_contact,
        lecturerFaculty: quotationPayload.lecturerFaculty || booking?.lect_faculty,
        lecturerId: quotationPayload.lecturerId || booking?.lect_id,
      });
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong while downloading the quotation.");
    } finally {
      setIsDownloadingQuotation(false);
    }
  }

  function handleDownloadReceipt() {
    setIsDownloadingReceipt(true);
    setErrorMessage("");

    try {
      downloadBookingReceiptPdf(booking || {});
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong while downloading the booking details.");
    } finally {
      setIsDownloadingReceipt(false);
    }
  }

  if (isLoading) {
    return <Loader text="Loading booking details..." />;
  }

  if (!booking) {
    return (
      <main className="min-h-full bg-background-main px-4 py-6">
        <p className="rounded-xl border border-warning/20 bg-white px-4 py-3 text-sm text-warning">
          {errorMessage || "Booking details could not be loaded."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-background-main px-4 py-6 md:px-7 md:py-8">
      <section className="mx-auto max-w-7xl space-y-7">
        <button
          type="button"
          onClick={() => router.push("/booking-records")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to records
        </button>

        <div className="rounded-2xl border border-border-light bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border-light bg-background-main px-3 py-1 text-xs font-semibold uppercase text-text-muted">
                  Request #{booking.id}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusClass(
                    booking.display_status_type,
                  )}`}
                >
                  {booking.display_status}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold text-text-main">
                {booking.item_count} equipment item
                {booking.item_count === 1 ? "" : "s"}
              </h1>
            </div>

            <div className="text-left md:text-right">
              {isProcessedBooking(booking) ? (
                <>
                  <p className="text-sm text-text-muted">Estimated Total</p>
                  <p className="text-xl font-semibold text-text-main">
                    {formatRm(getBookingEstimatedTotal(booking))}
                  </p>
                  <p className="mt-2 text-sm text-text-muted">Final Total</p>
                  <p className="text-3xl font-semibold text-primary">
                    {formatRm(getBookingFinalTotal(booking))}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-text-muted">Total</p>
                  <p className="text-3xl font-semibold text-primary">
                    {formatRm(getBookingFinalTotal(booking))}
                  </p>
                </>
              )}
              {[
                "pending_unit_leader_process",
                "pending_ppmu_process",
              ].includes(booking.display_status_type) ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="mt-4"
                >
                  {isCancelling ? "Cancelling..." : "Cancel Request"}
                </Button>
              ) : null}
              {canDownloadReceipt(booking) || isProcessedBooking(booking) ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row md:justify-end">
                  {canDownloadReceipt(booking) ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleDownloadReceipt}
                      disabled={isDownloadingReceipt}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      {isDownloadingReceipt
                        ? "Preparing..."
                        : "Download Booking Details"}
                    </Button>
                  ) : null}
                  {isProcessedBooking(booking) ? (
                    <Button
                      type="button"
                      onClick={handleDownloadQuotation}
                      disabled={isDownloadingQuotation}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      {isDownloadingQuotation
                        ? "Preparing..."
                        : "Download Quotation"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {errorMessage ? (
            <p className="mt-5 rounded-xl border border-warning/20 bg-white px-4 py-3 text-sm text-warning">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="space-y-5">
          <DetailSection title="User Details">
            <Info label="Username" value={booking.user_name || "-"} />
            <Info label="Role" value={booking.user_role || "-"} />
            <Info label="Email" value={booking.user_email || "-"} />
            <Info label="User ID" value={booking.requester_identifier || "-"} />
            <Info label="Faculty" value={booking.requester_faculty || "-"} />
            <Info label="Contact" value={booking.requester_contact || "-"} />
            <Info
              label="Study Level"
              value={formatStudyLevel(booking.study_level)}
            />
          </DetailSection>

          <DetailSection title="Lecturer Details">
            <Info label="Lecturer Name" value={booking.lect_name || "-"} />
            <Info label="Lecturer Email" value={booking.lect_email || "-"} />
            <Info
              label="Lecturer Contact"
              value={booking.lect_contact || "-"}
            />
            <Info label="Faculty" value={booking.lect_faculty || "-"} />
            <Info label="ID Number" value={booking.lect_id || "-"} />
            <Info label="VOT Number" value={booking.vot_number || "-"} />
          </DetailSection>

          <DetailSection title="PIC Details">
            <Info label="PIC Token" value={booking.pic_token || "-"} />
            <Info label="PIC Name" value={booking.pic_name || "-"} />
            <Info label="PIC Email" value={booking.pic_email || "-"} />
          </DetailSection>

          <DetailSection title="Request Details">
            <Info
              label="Request Details"
              value={booking.request_details || "-"}
              wide
            />
          </DetailSection>
        </div>

        <div className="space-y-5">
          {booking.items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-border-light bg-white p-6 shadow-sm"
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

                {isProcessedBooking(booking) ? (
                  <div className="text-left lg:text-right">
                    <p className="text-sm font-semibold text-text-main">
                      Estimated: {formatRm(getItemEstimatedTotal(item))}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-primary">
                      Final: {formatRm(getItemFinalTotal(item))}
                    </p>
                  </div>
                ) : (
                  <p className="text-xl font-semibold text-primary">
                    {formatRm(getItemFinalTotal(item))}
                  </p>
                )}
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
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ReviewCard
                    title="Unit Leader Recommendation"
                    decision={formatUnitLeaderDecision(item.unit_leader_process)}
                    process={item.unit_leader_process}
                  />
                  <ReviewCard
                    title="PPMU Review"
                    decision={formatPpmuDecision(item)}
                    process={item.ppmu_process}
                    showReviewerDetails={
                      item.unit_leader_process?.decision !== "rejected"
                    }
                  />
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
        wide ? "md:col-span-2" : ""
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

function ReviewCard({ title, decision, process, showReviewerDetails = true }) {
  return (
    <div className={`rounded-xl border p-4 ${reviewCardClass(process)}`}>
      <p className="flex items-center gap-2 text-sm font-semibold text-text-main">
        <UserRound className="h-4 w-4 text-primary" />
        {title}
      </p>
      <p className={`mt-2 text-sm font-semibold ${reviewDecisionClass(process)}`}>
        {decision}
      </p>
      {showReviewerDetails && process ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ItemInfo label="Name" value={process.reviewer_name || "-"} />
          <ItemInfo label="Email" value={process.reviewer_email || "-"} />
        </div>
      ) : null}
      {showReviewerDetails ? (
        <p className="mt-3 text-sm text-text-muted">
          {process?.remarks || process?.rejection_reason || "No remarks yet."}
        </p>
      ) : null}
    </div>
  );
}
