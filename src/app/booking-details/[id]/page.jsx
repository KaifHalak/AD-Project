"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  FileText,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTime(timeString) {
  if (!timeString) return "N/A";
  const [hours = "0", minutes = "0"] = String(timeString).split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPrice(value) {
  if (value === null || value === undefined) return "N/A";
  return `RM${Number(value).toFixed(2)}`;
}

function generateRequestId(createdAt, id) {
  if (!createdAt) return id || "N/A";
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const shortId = String(id).split("-").pop()?.slice(-4).padStart(4, "0") || "0000";
  return `REQ-${year}-${shortId}`;
}

function getStatusStyles(status) {
  switch (status) {
    case "approved":
      return "border-green-300 bg-green-50 text-green-700";
    case "pending":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "cancelled":
      return "border-border-light bg-background-main text-text-muted";
    case "rejected":
      return "border-warning/20 bg-white text-warning";
    default:
      return "border-border-light bg-white text-text-muted";
  }
}

function getDecisionBadge(decision) {
  if (!decision) {
    return (
      <span className="inline-flex items-center rounded-full border border-border-light bg-background-main px-3 py-1 text-xs font-semibold text-text-muted">
        Pending
      </span>
    );
  }

  if (decision === "approved") {
    return (
      <span className="inline-flex items-center rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
        Approved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-warning/20 bg-white px-3 py-1 text-xs font-semibold text-warning">
      Rejected
    </span>
  );
}

export default function BookingDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const { data: sessionData } = await getCurrentSession();
      const accessToken = sessionData?.session?.access_token || "";

      if (!accessToken) {
        router.push("/");
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(`/api/bookings/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/");
          return;
        }
        setErrorMessage(responseData?.error || "Could not load booking details.");
        return;
      }

      setData(responseData);
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while loading booking details.");
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCancel() {
    if (!data?.booking) return;

    setIsCancelling(true);
    setCancelError("");

    try {
      const { data: sessionData } = await getCurrentSession();
      const accessToken = sessionData?.session?.access_token || "";

      const response = await fetch(`/api/bookings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: "cancelled" }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setCancelError(responseData?.error || "Could not cancel booking.");
        return;
      }

      // Refresh data to show cancelled status
      fetchData();
      setShowCancelModal(false);
    } catch (error) {
      console.error(error);
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return <Loader text="Loading booking details..." />;
  }

  if (errorMessage) {
    return (
      <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-warning/20 bg-white p-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-warning" />
            <h1 className="mt-4 text-xl font-semibold text-text-main">Error</h1>
            <p className="mt-2 text-sm text-text-muted">{errorMessage}</p>
            <Link
              href="/booking-records"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Booking Records
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!data?.booking) {
    return (
      <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-border-light bg-white p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-text-muted" />
            <h1 className="mt-4 text-xl font-semibold text-text-main">
              Booking Not Found
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              The booking you are looking for does not exist.
            </p>
            <Link
              href="/booking-records"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Booking Records
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { booking, user, pic, unitLeaderReview, ppmuReview } = data;
  const requestId = generateRequestId(booking.created_at, booking.id);
  const requestType = booking.booking_type === "lab" ? "Lab Booking" : "Equipment Booking";

  // Cancel allowed only when pending (not yet reviewed by anyone)
  const canCancel =
    booking.status === "pending" && !unitLeaderReview && !ppmuReview;

  // Reschedule allowed only when fully approved by both Unit Leader AND PPMU
  const canReschedule =
    booking.status === "approved" &&
    unitLeaderReview?.decision === "approved" &&
    ppmuReview?.decision === "approved";

  return (
    <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Back button */}
        <Link
          href="/booking-records"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Booking Records
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-text-main">
            Booking Details
          </h1>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase ${getStatusStyles(
                booking.status
              )}`}
            >
              {booking.status}
            </span>
          </div>
        </div>

        {/* Review Instructions - Dynamic based on status */}
        {booking.status === "cancelled" ? (
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
            <h2 className="text-sm font-semibold text-warning">Booking Cancelled</h2>
            <p className="mt-1 text-sm text-text-muted">
              This booking has been cancelled. No further actions can be taken.
            </p>
          </div>
        ) : booking.status === "rejected" ? (
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
            <h2 className="text-sm font-semibold text-warning">Booking Rejected</h2>
            <p className="mt-1 text-sm text-text-muted">
              This booking request was rejected. Please review the remarks below for details.
            </p>
          </div>
        ) : unitLeaderReview?.decision === "rejected" ? (
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
            <h2 className="text-sm font-semibold text-warning">Rejected by Unit Leader</h2>
            <p className="mt-1 text-sm text-text-muted">
              This booking was rejected by the Unit Leader. No PPMU review will be conducted.
            </p>
          </div>
        ) : ppmuReview?.decision === "rejected" ? (
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
            <h2 className="text-sm font-semibold text-warning">Rejected by PPMU</h2>
            <p className="mt-1 text-sm text-text-muted">
              This booking was rejected by PPMU. Please review the remarks below for details.
            </p>
          </div>
        ) : unitLeaderReview?.decision === "approved" && ppmuReview?.decision === "approved" ? (
          <div className="rounded-xl border border-green-300/30 bg-green-50/50 p-4">
            <h2 className="text-sm font-semibold text-green-700">Booking Fully Approved</h2>
            <p className="mt-1 text-sm text-text-muted">
              This booking has been approved by both Unit Leader and PPMU. You can reschedule if needed.
            </p>
          </div>
        ) : unitLeaderReview?.decision === "approved" && !ppmuReview ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <h2 className="text-sm font-semibold text-primary">Awaiting PPMU Review</h2>
            <p className="mt-1 text-sm text-text-muted">
              This booking has been approved by the Unit Leader and is awaiting PPMU review.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <h2 className="text-sm font-semibold text-primary">Review Instructions</h2>
            <p className="mt-1 text-sm text-text-muted">
              Your booking request is pending review. You can cancel this booking while it awaits approval.
            </p>
          </div>
        )}

        {/* Request Overview */}
        <section className="rounded-xl border border-border-light bg-white p-5">
          <h2 className="text-lg font-semibold text-text-main">
            Request Overview
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Request ID
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {requestId}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Request Type
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {requestType}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Current Status
              </p>
              <div className="mt-1">{getDecisionBadge(booking.status)}</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Booking Date
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {formatDate(booking.booking_date)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Request Made
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {formatDateTime(booking.created_at)}
              </p>
            </div>
          </div>
        </section>

        {/* PIC Details */}
        {pic && (
          <section className="rounded-xl border border-border-light bg-white p-5">
            <h2 className="text-lg font-semibold text-text-main">
              PIC Details
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  PIC Username
                </p>
                <p className="mt-1 text-sm font-medium text-text-main">
                  {pic.username}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  PIC Email
                </p>
                <p className="mt-1 text-sm font-medium text-text-main">
                  {pic.email}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  PIC Code Used
                </p>
                <p className="mt-1 text-sm font-medium text-text-main">
                  {pic.token}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Date Code Generated
                </p>
                <p className="mt-1 text-sm font-medium text-text-main">
                  {formatDate(pic.generatedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Code Expiry Date
                </p>
                <p className="mt-1 text-sm font-medium text-text-main">
                  {formatDate(pic.expiresAt)}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* User Information */}
        <section className="rounded-xl border border-border-light bg-white p-5">
          <h2 className="text-lg font-semibold text-text-main">
            User Information
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                User Name
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {user?.name || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                User Email
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {user?.email || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                User Role
              </p>
              <p className="mt-1 text-sm font-medium text-text-main capitalize">
                {user?.role || "N/A"}
              </p>
            </div>
          </div>
        </section>

        {/* Booking Information */}
        <section className="rounded-xl border border-border-light bg-white p-5">
          <h2 className="text-lg font-semibold text-text-main">
            Booking Information
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {booking.booking_type === "lab" ? "Lab Name" : "Equipment Name"}
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {booking.resource_name}
              </p>
              {booking.resource_subtitle && (
                <p className="mt-1 text-xs text-text-muted">
                  {booking.resource_subtitle}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Start Date & Time
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-text-main">
                <Calendar className="h-4 w-4 text-text-muted" />
                {formatDate(booking.booking_date)}
                <Clock className="ml-2 h-4 w-4 text-text-muted" />
                {formatTime(booking.start_time)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                End Date & Time
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-text-main">
                <Calendar className="h-4 w-4 text-text-muted" />
                {formatDate(booking.booking_date)}
                <Clock className="ml-2 h-4 w-4 text-text-muted" />
                {formatTime(booking.end_time)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Grant Number
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {booking.grant_number || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                VOT Number
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {booking.vot_number || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Total Price
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {formatPrice(booking.total_price)}
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Reason for Booking
              </p>
              <p className="mt-1 text-sm text-text-main">
                {booking.reason}
              </p>
            </div>
          </div>
        </section>

        {/* Invoice - Only show for approved bookings or if price exists */}
        {(booking.status === "approved" || booking.total_price) && (
          <section className="rounded-xl border border-border-light bg-white p-5">
            <h2 className="text-lg font-semibold text-text-main">Invoice</h2>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => alert("PDF download coming soon!")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                <Download className="h-4 w-4" />
                Download PDF Quotation
              </button>
            </div>
          </section>
        )}

        {/* Unit Leader Review */}
        <section className="rounded-xl border border-border-light bg-white p-5">
          <h2 className="text-lg font-semibold text-text-main">
            Unit Leader Review
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Decision
              </p>
              <div className="mt-1">
                {getDecisionBadge(unitLeaderReview?.decision)}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Decision Date
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {unitLeaderReview?.decisionAt
                  ? formatDate(unitLeaderReview.decisionAt)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Approver Name
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {unitLeaderReview?.approver?.name || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Approver Email
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {unitLeaderReview?.approver?.email || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Approver Role
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">
                {unitLeaderReview?.approver?.role || "Unit Leader"}
              </p>
            </div>
            {unitLeaderReview?.remarks && (
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Remarks
                </p>
                <p className="mt-1 text-sm text-text-main">
                  {unitLeaderReview.remarks}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* PPMU Review - Only show if Unit Leader approved (PPMU doesn't review rejected bookings) */}
        {unitLeaderReview?.decision !== "rejected" && (
          <section className="rounded-xl border border-border-light bg-white p-5">
            <h2 className="text-lg font-semibold text-text-main">
              PPMU Review
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Decision
                </p>
                <div className="mt-1">
                  {getDecisionBadge(ppmuReview?.decision)}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Decision Date
                </p>
                <p className="mt-1 text-sm font-medium text-text-main">
                  {ppmuReview?.decisionAt
                    ? formatDate(ppmuReview.decisionAt)
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Approver Name
                </p>
                <p className="mt-1 text-sm font-medium text-text-main">
                  {ppmuReview?.approver?.name || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Approver Email
                </p>
                <p className="mt-1 text-sm font-medium text-text-main">
                  {ppmuReview?.approver?.email || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Approver Role
                </p>
                <p className="mt-1 text-sm font-medium text-text-main">
                  {ppmuReview?.approver?.role || "PPMU Officer"}
                </p>
              </div>
              {ppmuReview?.remarks && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Remarks
                  </p>
                  <p className="mt-1 text-sm text-text-main">
                    {ppmuReview.remarks}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Action Buttons - Only show for active bookings */}
        {booking.status !== "cancelled" && booking.status !== "rejected" && (
          <div className="flex flex-wrap gap-3 pb-6">
            {canReschedule && (
              <Link
                href={
                  booking.booking_type === "lab"
                    ? `/lab-booking/${encodeURIComponent(
                        booking.item_id
                      )}?date=${booking.booking_date}&start=${formatTime(
                        booking.start_time
                      )}&end=${formatTime(
                        booking.end_time
                      )}&rescheduleFrom=${booking.id}`
                    : `/equipment-booking/${encodeURIComponent(
                        booking.item_id
                      )}?date=${booking.booking_date}&start=${formatTime(
                        booking.start_time
                      )}&end=${formatTime(
                        booking.end_time
                      )}&rescheduleFrom=${booking.id}`
                }
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                Reschedule Booking
              </Link>
            )}

            {canCancel && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCancelModal(true)}
                className="border-warning text-warning hover:bg-warning/5"
              >
                Cancel Booking
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border-light bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-primary">
                  Cancel Booking
                </h2>
                <p className="mt-2 text-sm text-text-main">
                  Are you sure you want to cancel{" "}
                  <span className="font-semibold">{booking.resource_name}</span>{" "}
                  on {formatDate(booking.booking_date)}?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="rounded-lg border border-border-light p-2 text-text-muted transition-colors hover:bg-background-main"
                aria-label="Close cancel dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {cancelError && (
              <p className="mt-4 rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
                {cancelError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
              >
                Keep Booking
              </Button>
              <Button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="bg-warning text-white hover:bg-red-700"
              >
                {isCancelling ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
