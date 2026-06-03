"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, X } from "lucide-react";
import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import { formatRmFromUsd } from "@/lib/currency";
import { downloadQuotationPdf } from "@/lib/quotationPdf";
import { getCurrentSession } from "@/lib/supabase/auth";

function formatDate(dateString) {
  if (!dateString) return "-";
  return dateString;
}

function formatDateTime(dateTimeValue) {
  if (!dateTimeValue) return "-";

  return new Date(dateTimeValue).toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

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

function formatPrice(value) {
  return value === null || value === undefined ? "-" : formatRmFromUsd(value);
}

function getTypeLabel(type) {
  return type === "lab" ? "Lab Booking" : "Equipment Booking";
}

function getResourceLabel(type) {
  return type === "lab" ? "Lab Name" : "Equipment Name";
}

function getStatusType(decision) {
  if (decision === "approved" || decision === "rejected") return decision;
  return "pending";
}

function getRescheduleHref(booking) {
  const start = String(booking.start_time || "").slice(0, 5);
  const end = String(booking.end_time || "").slice(0, 5);
  const basePath =
    booking.booking_type === "lab"
      ? `/lab-booking/${encodeURIComponent(booking.item_id)}`
      : `/equipment-booking/${encodeURIComponent(booking.item_id)}`;

  return `${basePath}?date=${booking.booking_date}&start=${start}&end=${end}&rescheduleFrom=${booking.id}`;
}

export default function BookingRecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [booking, setBooking] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const fetchBooking = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const { data: sessionData } = await getCurrentSession();
      const token = sessionData?.session?.access_token || "";

      if (!token) {
        router.push("/");
        return;
      }

      setAccessToken(token);

      const response = await fetch(`/api/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Could not load booking details.");
        return;
      }

      setBooking(data.booking);
    } catch {
      setErrorMessage("Something went wrong while loading booking details.");
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    }
  }, [bookingId, fetchBooking]);

  async function handleConfirmCancel() {
    if (!booking || !accessToken) return;

    setIsCancelling(true);
    setCancelError("");

    try {
      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await response.json();

      if (!response.ok) {
        setCancelError(data.error || "Could not cancel booking.");
        return;
      }

      setBooking((current) => ({
        ...current,
        status: "cancelled",
        source_status: "cancelled",
        display_status: "Cancelled",
        display_status_type: "cancelled",
        is_final_approved: false,
      }));
      setShowCancelDialog(false);
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  function handleDownloadQuotation() {
    const quotationPayload = booking?.quotation?.quotation_payload;

    if (!quotationPayload) return;

    downloadQuotationPdf(quotationPayload);
  }

  if (isLoading) {
    return <Loader text="Loading booking details..." />;
  }

  if (!booking) {
    return (
      <main className="min-h-screen bg-background-main px-4 py-6 md:px-8">
        <Header onBack={() => router.back()} />
        <p className="rounded-xl border border-warning/20 bg-white px-4 py-3 text-sm text-warning">
          {errorMessage || "Booking details could not be loaded."}
        </p>
      </main>
    );
  }

  const canCancel =
    ["pending", "approved"].includes(booking.source_status || booking.status) &&
    booking.display_status_type !== "rejected";

  return (
    <main className="min-h-screen bg-background-main px-4 py-6 md:px-8">
      <Header onBack={() => router.back()} />

      {errorMessage ? (
        <p className="mb-5 rounded-xl border border-warning/20 bg-white px-4 py-3 text-sm text-warning">
          {errorMessage}
        </p>
      ) : null}

      {/* <div className="mb-5 rounded-xl border border-pink-200 bg-pink-50 p-5 text-sm text-text-muted">
        <p className="font-semibold text-primary">Review Instructions</p>
        <p className="mt-2">
          Review the booking details carefully. You can reschedule or cancel
          this booking using the buttons at the bottom.
        </p>
      </div> */}

      <div className="space-y-5">
        <Section title="Request Overview">
          <Grid>
            <Field label="Request ID" value={booking.id} />
            <Field
              label="Request Type"
              value={getTypeLabel(booking.booking_type)}
            />
            <Field label="Current Status">
              <Badge
                text={booking.display_status || booking.status || "-"}
                type={booking.display_status_type}
              />
            </Field>
            <Field
              label="Booking Date"
              value={formatDate(booking.booking_date)}
            />
            <Field
              label="Request Made"
              value={formatDateTime(booking.created_at)}
            />
          </Grid>
        </Section>

        <Section title="PIC Details">
          <Grid>
            <Field label="PIC Username" value={booking.pic_name || "N/A"} />
            <Field label="PIC Email" value={booking.pic_email || "N/A"} />
            <Field label="PIC Code Used" value={booking.pic_token || "-"} />
          </Grid>
        </Section>

        <Section title="User Information">
          <Grid>
            <Field label="User Name" value={booking.user_name} />
            <Field label="User Email" value={booking.user_email} />
            <Field label="User Role" value={booking.user_role} />
            <Field
              label="User ID"
              value={booking.requester_identifier || "-"}
            />
            <Field label="Faculty" value={booking.requester_faculty || "-"} />
            <Field
              label="Contact Number"
              value={booking.requester_contact || "-"}
            />
          </Grid>
        </Section>

        <Section title="Staff Information">
          <Grid>
            <Field label="Staff Name" value={booking.staff_name || "-"} />
            <Field label="Staff Email" value={booking.staff_email || "-"} />
            <Field
              label="Staff Contact"
              value={booking.staff_contact || "-"}
            />
          </Grid>
        </Section>

        <Section title="Booking Information">
          <div className="space-y-8">
            <Field
              label={getResourceLabel(booking.booking_type)}
              value={booking.resource_name}
            />

            <Grid>
              <Field
                label="Start Date & Time"
                value={`${formatDate(booking.booking_date)} ${formatTime(
                  booking.start_time,
                )}`}
              />
              <Field
                label="End Date & Time"
                value={`${formatDate(booking.booking_date)} ${formatTime(
                  booking.end_time,
                )}`}
              />
              <Field label="VOT Number" value={booking.vot_number || "-"} />
              <Field
                label="Total Price"
                value={formatPrice(booking.total_price)}
              />
            </Grid>

            <Field
              label="Reason for Booking"
              value={booking.booking_reason || "No reason provided."}
            />
          </div>
        </Section>

        <Section title="Quotation">
          {booking.quotation?.quotation_payload ? (
            <p className="mb-3 text-sm text-text-muted">
              Quotation {booking.quotation.quotation_number} is available for
              download.
            </p>
          ) : (
            <p className="mb-3 text-sm text-text-muted">
              No saved quotation is available for this booking.
            </p>
          )}
          <button
            type="button"
            disabled={!booking.quotation?.quotation_payload}
            onClick={handleDownloadQuotation}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white ${
              booking.quotation?.quotation_payload
                ? "bg-primary transition-colors hover:bg-primary-hover"
                : "cursor-not-allowed bg-primary opacity-60"
            }`}
          >
            <Download className="h-4 w-4" />
            Download PDF Quotation
          </button>
        </Section>

        <ReviewSection
          title="Unit Leader Review"
          decision={booking.unit_leader_status}
          decisionType={getStatusType(booking.unit_leader_decision)}
          date={booking.unit_leader_date}
          name={booking.unit_leader_name}
          email={booking.unit_leader_email}
          role={booking.unit_leader_role}
          remarks={booking.unit_leader_remarks}
        />

        <ReviewSection
          title="PPMU Review"
          decision={booking.ppmu_status}
          decisionType={getStatusType(booking.ppmu_decision)}
          date={booking.ppmu_date}
          name={booking.ppmu_name}
          email={booking.ppmu_email}
          role={booking.ppmu_role}
          remarks={booking.ppmu_remarks}
        />
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        {canCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setCancelError("");
              setShowCancelDialog(true);
            }}
            className="border-primary text-primary sm:w-auto"
          >
            Cancel Booking
          </Button>
        ) : null}

        {booking.is_final_approved ? (
          <Link
            href={getRescheduleHref(booking)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Reschedule Booking
          </Link>
        ) : null}
      </div>

      {showCancelDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border-light bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-primary">
                  Cancel Booking
                </h2>
                <p className="mt-2 text-sm text-text-main">
                  Cancel {booking.resource_name} on{" "}
                  {formatDate(booking.booking_date)}?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelDialog(false)}
                className="rounded-lg border border-border-light p-2 text-text-muted transition-colors hover:bg-background-main"
                aria-label="Close cancel dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {cancelError ? (
              <p className="mt-4 rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
                {cancelError}
              </p>
            ) : null}

            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCancelDialog(false)}
                disabled={isCancelling}
              >
                Keep Booking
              </Button>
              <Button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Header({ onBack }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg p-1 text-text-main transition-colors hover:bg-white"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="text-3xl font-bold text-text-main">Booking Details</h1>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-border-light bg-white p-5 md:p-6">
      <h2 className="mb-5 text-lg font-semibold text-text-main">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
}

function Field({ label, value, children }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-primary">
        {label}
      </p>
      <div className="break-words text-sm font-medium text-text-main md:text-base">
        {children || value || "-"}
      </div>
    </div>
  );
}

function Badge({ text, type }) {
  const styles = {
    approved: "border-green-200 bg-green-50 text-green-700",
    pending: "border-yellow-200 bg-yellow-50 text-yellow-700",
    rejected: "border-red-200 bg-red-50 text-red-700",
    cancelled: "border-border-light bg-background-main text-text-muted",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        styles[type] || styles.pending
      }`}
    >
      {text}
    </span>
  );
}

function ReviewSection({
  title,
  decision,
  decisionType,
  date,
  name,
  email,
  role,
  remarks,
}) {
  return (
    <Section title={title}>
      <Grid>
        <Field label="Decision">
          <Badge text={decision || "Pending"} type={decisionType} />
        </Field>
        <Field label="Decision Date" value={formatDateTime(date)} />
        <Field label="Approver Name" value={name || "N/A"} />
        <Field label="Approver Email" value={email || "N/A"} />
        <Field label="Approver Role" value={role || "N/A"} />
        <Field label="Remarks" value={remarks || "No remarks provided."} />
      </Grid>
    </Section>
  );
}
