"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";

function buildPrefillPath(booking) {
  if (!booking) {
    return "";
  }

  const basePath =
    booking.booking_type === "lab"
      ? `/lab-booking/${encodeURIComponent(booking.item_id)}`
      : `/equipment-booking/${encodeURIComponent(booking.item_id)}`;

  const params = new URLSearchParams({
    date: String(booking.booking_date || "").slice(0, 10),
    start: String(booking.start_time || "").slice(0, 5),
    end: String(booking.end_time || "").slice(0, 5),
    rescheduleFrom: booking.id,
  });

  return `${basePath}?${params.toString()}`;
}

export default function BookingReschedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id") || "";

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [fallbackPath, setFallbackPath] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function redirectToPrefilledBookingPage() {
      try {
        const { data: sessionData } = await getCurrentSession();

        if (!isMounted) {
          return;
        }

        if (!sessionData?.session) {
          router.push("/");
          return;
        }

        if (!bookingId) {
          setErrorMessage("Missing booking ID.");
          return;
        }

        const accessToken = sessionData.session.access_token;
        const response = await fetch(`/api/bookings/${bookingId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json();

        if (!response.ok || !data?.booking) {
          setErrorMessage(data?.error || "Could not load booking details.");
          return;
        }

        const targetPath = buildPrefillPath(data.booking);
        if (!targetPath) {
          setErrorMessage("Could not build reschedule path.");
          return;
        }

        setFallbackPath(targetPath);
        router.replace(targetPath);
      } catch {
        if (isMounted) {
          setErrorMessage("Could not redirect to booking page.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    redirectToPrefilledBookingPage();

    return () => {
      isMounted = false;
    };
  }, [bookingId, router]);

  if (isLoading) {
    return <Loader text="Redirecting to booking page..." />;
  }

  return (
    <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
      <section className="rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
        <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border-light bg-white p-5 text-sm text-text-muted md:p-6">
          <p className="font-semibold text-primary">Reschedule flow updated</p>
          <p>
            Rescheduling now creates a new booking request from the booking page,
            while your original approved booking stays active.
          </p>

          {errorMessage ? (
            <p className="rounded-lg border border-warning/20 bg-white px-3 py-2 text-warning">
              {errorMessage}
            </p>
          ) : null}

          {fallbackPath ? (
            <Link
              href={fallbackPath}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Continue to booking page
            </Link>
          ) : (
            <Link
              href="/booking-records"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border-light px-4 font-semibold text-text-main transition-colors hover:bg-background-main"
            >
              Back to booking records
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
