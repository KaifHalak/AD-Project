"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";

const VALID_START_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];
const VALID_END_TIMES = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

function formatDateDisplay(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateForInput(dateString) {
  return (dateString || "").slice(0, 10);
}

function calcDuration(start, end) {
  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);
  const totalMinutes = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);

  if (totalMinutes <= 0) return "-";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export default function BookingReschedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingId = searchParams.get("id") || "";
  const bookingName = searchParams.get("name") || "";

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [booking, setBooking] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [newDate, setNewDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [reason, setReason] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const { data: sessionData } = await getCurrentSession();

        if (!isMounted) return;

        if (!sessionData?.session) {
          router.push("/");
          return;
        }

        if (!bookingId) {
          setErrorMessage("No booking ID provided.");
          setIsLoading(false);
          return;
        }

        const token = sessionData.session.access_token;
        setAccessToken(token);

        const response = await fetch(`/api/bookings/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          setErrorMessage(data.error || "Could not load booking details.");
          return;
        }

        const loadedBooking = data.booking;
        setBooking(loadedBooking);
        setNewDate(formatDateForInput(loadedBooking.booking_date));
        setStartTime((loadedBooking.start_time || "09:00").slice(0, 5));
        setEndTime((loadedBooking.end_time || "11:00").slice(0, 5));
      } catch {
        if (isMounted) {
          setErrorMessage("Could not load booking details.");
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
  }, [router, bookingId]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!bookingId || isSubmitting) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (!newDate) {
      setErrorMessage("Please select a new date.");
      return;
    }

    if (startTime >= endTime) {
      setErrorMessage("End time must be after start time.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          booking_date: newDate,
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Could not reschedule booking.");
        return;
      }

      setSuccessMessage("Booking rescheduled successfully.");
      setTimeout(() => router.push("/booking-records"), 1200);
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <Loader text="Loading booking details..." />;
  }

  const displayName = bookingName || booking?.resource_name || "Booking";
  const bookingType = booking?.booking_type === "lab" ? "Lab" : "Equipment";
  const originalDate = booking?.booking_date
    ? formatDateDisplay(booking.booking_date)
    : "-";
  const originalTime = booking
    ? `${(booking.start_time || "").slice(0, 5)} - ${(booking.end_time || "").slice(0, 5)}`
    : "-";

  return (
    <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
      <section className="min-h-[calc(100vh-7rem)] w-full rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
        <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
          <div>
            <Link
              href="/booking-records"
              className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to booking records
            </Link>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-semibold text-primary">
              Reschedule Booking
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Choose a new date and time for your {bookingType.toLowerCase()} booking.
            </p>
          </div>

          {errorMessage ? (
            <p className="rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {successMessage}
            </p>
          ) : null}

          <section className="rounded-xl border border-border-light bg-white p-4 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Booking
            </p>
            <h2 className="mt-2 text-xl font-semibold text-text-main">
              {displayName}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {bookingType} ID: {booking?.item_id || "-"}
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border-light bg-white p-4 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Original Date
              </p>
              <p className="mt-3 flex items-center gap-2 text-text-main">
                <Calendar className="h-4 w-4 text-text-muted" />
                {originalDate}
              </p>
            </div>

            <div className="rounded-xl border border-border-light bg-white p-4 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Original Time
              </p>
              <p className="mt-3 flex items-center gap-2 text-text-main">
                <Clock className="h-4 w-4 text-text-muted" />
                {originalTime}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-border-light bg-white p-4 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              New Date and Time
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm font-semibold text-text-main">
                Date
                <input
                  type="date"
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-sm font-normal text-text-main outline-none transition-colors focus:border-primary"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold text-text-main">
                Start Time
                <select
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-sm font-normal text-text-main outline-none transition-colors focus:border-primary"
                >
                  {VALID_START_TIMES.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm font-semibold text-text-main">
                End Time
                <select
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-sm font-normal text-text-main outline-none transition-colors focus:border-primary"
                >
                  {VALID_END_TIMES.filter((time) => time > startTime).map(
                    (time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <p className="mt-4 rounded-lg border border-border-light bg-background-main px-3 py-2 text-sm text-text-muted">
              Duration: {calcDuration(startTime, endTime)}
            </p>
          </section>

          <section className="rounded-xl border border-border-light bg-white p-4 md:p-6">
            <label className="space-y-2 text-sm font-semibold text-text-main">
              Reason for Rescheduling
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Briefly explain the reason for rescheduling..."
                rows={5}
                className="w-full rounded-xl border border-border-light bg-white p-3 text-sm font-normal text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-primary"
              />
            </label>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => router.push("/booking-records")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Confirm Reschedule"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
