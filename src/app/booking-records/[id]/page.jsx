"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";
import { formatRmFromUsd } from "@/lib/currency";

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
  return String(value).replaceAll("_", " ").replace(/^\w/, (char) => char.toUpperCase());
}

function formatDecision(process) {
  if (!process) return "Pending";
  return process.decision === "approved" ? "Approved" : "Rejected";
}

function statusClass(status) {
  switch (status) {
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

export default function BookingRecordDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchBooking = useCallback(async (token) => {
    const response = await fetch(`/api/bookings/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    if (!response.ok) {
      setErrorMessage(data.error || "Could not load booking details.");
      return;
    }

    setBooking(data.booking);
  }, [id]);

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
              <p className="mt-2 text-sm text-text-muted">
                Submitted by {booking.user_name} | VOT {booking.vot_number || "-"}
              </p>
            </div>

            <div className="text-left md:text-right">
              <p className="text-sm text-text-muted">Total</p>
              <p className="text-3xl font-semibold text-primary">
                {formatRmFromUsd(booking.total_price || 0)}
              </p>
              {booking.display_status_type !== "cancelled" ? (
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
            <Info label="User ID" value={booking.requester_identifier || "-"} />
            <Info label="Faculty" value={booking.requester_faculty || "-"} />
            <Info label="Contact" value={booking.requester_contact || "-"} />
            <Info
              label="Study Level"
              value={formatStudyLevel(booking.study_level)}
            />
            <Info label="PIC Token" value={booking.pic_token || "-"} />
          </DetailSection>

          <DetailSection title="Lecturer Details">
            <Info label="Lecturer Name" value={booking.lect_name || "-"} />
            <Info label="Lecturer Email" value={booking.lect_email || "-"} />
            <Info label="Lecturer Contact" value={booking.lect_contact || "-"} />
          </DetailSection>

          <DetailSection title="Request Details">
            <Info label="Request Details" value={booking.request_details || "-"} wide />
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
                  <div className="mt-3 grid gap-2 text-sm text-text-muted md:grid-cols-2">
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {item.lab_name}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {formatDate(item.start_date)}
                      {item.end_date !== item.start_date
                        ? ` - ${formatDate(item.end_date)}`
                        : ""}{" "}
                      | {formatTime(item.start_time)} - {formatTime(item.end_time)}
                    </span>
                  </div>
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

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ReviewCard
                  title="Unit Leader Review"
                  decision={formatDecision(item.unit_leader_process)}
                  process={item.unit_leader_process}
                />
                <ReviewCard
                  title="PPMU Review"
                  decision={formatDecision(item.ppmu_process)}
                  process={item.ppmu_process}
                />
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
