"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Clock, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeString) {
  if (!timeString) return "";
  return timeString.slice(0, 5);
}

function getTypeLabel(type) {
  return type === "lab" ? "Lab" : "Equipment";
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

function getStatusLabel(status) {
  switch (status) {
    case "approved":
      return "Approved";
    case "pending":
      return "Pending Approval";
    case "cancelled":
      return "Cancelled";
    case "rejected":
      return "Rejected";
    default:
      return status || "-";
  }
}

export default function BookingRecordsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const fetchBookings = useCallback(async (token, filter) => {
    try {
      setErrorMessage("");
      const params = filter && filter !== "all" ? `?type=${filter}` : "";
      const response = await fetch(`/api/bookings${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

      try {
        const { data: sessionData } = await getCurrentSession();
        if (!isMounted) return;

        if (!sessionData?.session) {
          router.push("/");
          return;
        }

        const token = sessionData.session.access_token;
        setAccessToken(token);
        await fetchBookings(token, "all");
      } catch {
        if (isMounted) {
          setErrorMessage("Something went wrong. Please try again.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [router, fetchBookings]);

  function handleFilterChange(filter) {
    setSelectedFilter(filter);
    if (accessToken) {
      fetchBookings(accessToken, filter);
    }
  }

  function handleCancelClick(booking) {
    setBookingToCancel(booking);
    setCancelError("");
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

      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === bookingToCancel.id
            ? { ...booking, status: "cancelled" }
            : booking,
        ),
      );
      setBookingToCancel(null);
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return <Loader text="Loading booking records..." />;
  }

  const activeCancellableStatuses = ["pending", "approved"];

  return (
    <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
      <section className="min-h-[calc(100vh-7rem)] w-full rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-primary">
              Booking Records
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              View and manage your lab and equipment booking requests.
            </p>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="flex flex-col gap-2 text-sm font-semibold text-text-main sm:w-64">
                Filter by Type
                <select
                  value={selectedFilter}
                  onChange={(event) => handleFilterChange(event.target.value)}
                  className="h-11 rounded-xl border border-border-light bg-white px-3 text-sm font-normal text-text-main outline-none transition-colors focus:border-primary"
                >
                  <option value="all">All Bookings</option>
                  <option value="lab">Lab Bookings</option>
                  <option value="equipment">Equipment Bookings</option>
                </select>
              </label>

              <p className="text-sm text-text-muted">
                Showing {bookings.length} booking
                {bookings.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {errorMessage ? (
            <p className="rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
              {errorMessage}
            </p>
          ) : null}

          <div className="space-y-4">
            {bookings.map((booking) => (
              <article
                key={booking.id}
                className="rounded-xl border border-border-light bg-white p-4 md:p-6"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-border-light bg-background-main px-3 py-1 text-xs font-semibold uppercase text-text-muted">
                        {getTypeLabel(booking.booking_type)}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${getStatusStyles(booking.status)}`}
                      >
                        {getStatusLabel(booking.status)}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-xl font-semibold text-text-main">
                        {booking.resource_name}
                      </h2>
                      <p className="mt-1 text-sm text-text-muted">
                        ID: {booking.item_id}
                        {booking.resource_subtitle
                          ? ` | ${booking.resource_subtitle}`
                          : ""}
                      </p>
                    </div>

                    <div className="grid gap-3 text-sm text-text-main md:grid-cols-2">
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-text-muted" />
                        {formatDate(booking.booking_date)}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-text-muted" />
                        {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    {booking.status === "approved" ? (
                      <Link
                        href={`/booking-reschedule?id=${booking.id}&type=${booking.booking_type}&name=${encodeURIComponent(booking.resource_name)}`}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-white transition-colors hover:bg-primary-hover"
                      >
                        Reschedule
                      </Link>
                    ) : null}

                    {activeCancellableStatuses.includes(booking.status) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleCancelClick(booking)}
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
            <div className="rounded-xl border border-border-light bg-white px-4 py-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-semibold text-text-main">
                No bookings found
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {selectedFilter === "all"
                  ? "You have not made any bookings yet."
                  : `No ${selectedFilter} bookings found.`}
              </p>
            </div>
          ) : null}
        </div>
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
                  Cancel {bookingToCancel.resource_name} on{" "}
                  {formatDate(bookingToCancel.booking_date)}?
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
