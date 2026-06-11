"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Clock, FileText, PackageCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";
import { formatRmFromUsd } from "@/lib/currency";

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeString) {
  return timeString ? String(timeString).slice(0, 5) : "-";
}

function formatStudyLevel(value) {
  if (!value) return "-";
  return String(value).replaceAll("_", " ").replace(/^\w/, (char) => char.toUpperCase());
}

function getStatusStyles(status) {
  switch (status) {
    case "pending_unit_leader_process":
      return "border-primary/20 bg-primary/10 text-primary";
    case "pending_ppmu_process":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "processed":
    case "approved":
      return "border-green-300 bg-green-50 text-green-700";
    case "partially_approved":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "cancelled":
      return "border-border-light bg-background-main text-text-muted";
    case "rejected":
      return "border-warning/20 bg-white text-warning";
    default:
      return "border-primary/20 bg-primary/10 text-primary";
  }
}

export default function BookingRecordsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const fetchBookings = useCallback(async (token, statusFilter) => {
    try {
      setErrorMessage("");
      const params = new URLSearchParams();

      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const response = await fetch(
        `/api/bookings${params.toString() ? `?${params}` : ""}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Could not load bookings.");
        return;
      }

      setBookings(data.bookings || []);
    } catch {
      setErrorMessage("Something went wrong while loading bookings.");
    }
  }, []);

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
      await fetchBookings(token, "all");
      setIsLoading(false);
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [router, fetchBookings]);

  function handleStatusFilterChange(filter) {
    setSelectedStatusFilter(filter);
    if (accessToken) {
      fetchBookings(accessToken, filter);
    }
  }

  async function handleConfirmCancel() {
    if (!bookingToCancel) return;

    setIsCancelling(true);
    setCancelError("");

    try {
      const response = await fetch(`/api/bookings/${bookingToCancel.id}`, {
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

      setBookingToCancel(null);
      await fetchBookings(accessToken, selectedStatusFilter);
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return <Loader text="Loading booking records..." />;
  }

  return (
    <main className="min-h-full bg-background-main px-4 py-6 md:px-7 md:py-8">
      <section className="mx-auto max-w-7xl space-y-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-primary">Booking Records</h1>
            <p className="mt-2 text-sm text-text-muted">
              View and manage submitted booking requests.
            </p>
          </div>

          <label className="flex flex-col gap-2 text-sm font-semibold text-text-main sm:w-64">
            Filter by Status
            <select
              value={selectedStatusFilter}
              onChange={(event) => handleStatusFilterChange(event.target.value)}
              className="h-11 rounded-xl border border-border-light bg-white px-3 text-sm font-normal text-text-main outline-none transition-colors focus:border-primary"
            >
              <option value="all">All Statuses</option>
              <option value="pending_unit_leader_process">
                Pending Unit Leader Process
              </option>
              <option value="pending_ppmu_process">Pending PPMU Process</option>
              <option value="processed">Processed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>

        {errorMessage ? (
          <p className="rounded-xl border border-warning/20 bg-white px-4 py-3 text-sm text-warning">
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-4">
          {bookings.map((booking) => (
            <article
              key={booking.id}
              className="rounded-2xl border border-border-light bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border-light bg-background-main px-3 py-1 text-xs font-semibold uppercase text-text-muted">
                      Request #{booking.id}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${getStatusStyles(
                        booking.display_status_type,
                      )}`}
                    >
                      {booking.display_status || "-"}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-text-main">
                      {booking.resource_name}
                    </h2>
                    <p className="mt-1 text-sm text-text-muted">
                      {booking.resource_subtitle} | VOT {booking.vot_number || "-"} |
                      Study Level {formatStudyLevel(booking.study_level)}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm text-text-main md:grid-cols-3">
                    <p className="flex items-center gap-2">
                      <PackageCheck className="h-4 w-4 text-text-muted" />
                      {booking.item_count} item{booking.item_count === 1 ? "" : "s"}
                    </p>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-text-muted" />
                      {formatDate(booking.start_date)}
                      {booking.end_date && booking.end_date !== booking.start_date
                        ? ` - ${formatDate(booking.end_date)}`
                        : ""}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-text-muted" />
                      {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-primary">
                    {formatRmFromUsd(booking.total_price || 0)}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Link
                    href={`/booking-records/${encodeURIComponent(booking.id)}`}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border-light bg-white px-4 text-base font-semibold text-text-main transition-colors hover:bg-background-main"
                  >
                    View Details
                  </Link>

                  {[
                    "pending_unit_leader_process",
                    "pending_ppmu_process",
                  ].includes(booking.display_status_type) ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setBookingToCancel(booking);
                        setCancelError("");
                      }}
                      className="md:w-auto"
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>

        {bookings.length === 0 && !errorMessage ? (
          <div className="rounded-2xl border border-border-light bg-white px-4 py-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 font-semibold text-text-main">No bookings found</p>
            <p className="mt-1 text-sm text-text-muted">
              Your submitted booking requests will appear here.
            </p>
          </div>
        ) : null}
      </section>

      {bookingToCancel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border-light bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-primary">
                  Cancel Booking
                </h2>
                <p className="mt-2 text-sm text-text-main">
                  Cancel request #{bookingToCancel.id}?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookingToCancel(null)}
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
                onClick={() => setBookingToCancel(null)}
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
