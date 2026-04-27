"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentSession } from "@/lib/supabase/auth";
import { fetchVerificationStatus } from "@/lib/verificationClient";

export default function AppNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingBooking, setIsCheckingBooking] = useState(false);
  const [hasActiveVerification, setHasActiveVerification] = useState(false);

  const accountActive = pathname.startsWith("/account");
  const labBooking = pathname.startsWith("/lab-booking");
  const equipmentBooking = pathname.startsWith("/equipment-booking");
  const bookingRecordsActive = pathname.startsWith("/booking-records");

  useEffect(() => {
    let isMounted = true;

    if (pathname === "/") {
      setHasActiveVerification(false);
      return () => {
        isMounted = false;
      };
    }

    async function refreshVerificationBadge() {
      try {
        const { data: sessionData } = await getCurrentSession();

        if (!isMounted) {
          return;
        }

        if (!sessionData?.session) {
          setHasActiveVerification(false);
          return;
        }

        const accessToken = sessionData.session.access_token;
        const verificationResponse = await fetchVerificationStatus(accessToken);

        if (!isMounted) {
          return;
        }

        if (!verificationResponse.ok) {
          setHasActiveVerification(false);
          return;
        }

        setHasActiveVerification(
          Boolean(
            verificationResponse.data?.verified ||
            verificationResponse.data?.bypassVerification,
          ),
        );
      } catch {
        if (isMounted) {
          setHasActiveVerification(false);
        }
      }
    }

    refreshVerificationBadge();

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  // Keep the login screen focused by hiding global navigation on root route.
  if (pathname === "/") {
    return null;
  }

  async function handleBookingClick() {
    try {
      setIsCheckingBooking(true);

      const { data: sessionData } = await getCurrentSession();

      if (!sessionData?.session) {
        router.push("/");
        return;
      }

      const accessToken = sessionData.session.access_token;
      const verificationResponse = await fetchVerificationStatus(accessToken);

      if (!verificationResponse.ok) {
        router.push("/token-verification?redirect=/booking");
        return;
      }

      const canAccessBooking =
        verificationResponse.data?.verified ||
        verificationResponse.data?.bypassVerification;

      if (canAccessBooking) {
        router.push("/booking");
        return;
      }

      router.push("/token-verification?redirect=/booking");
    } catch {
      router.push("/token-verification?redirect=/booking");
    } finally {
      setIsCheckingBooking(false);
    }
  }

  return (
    <header className="border-b border-border-light bg-panel">
      <nav className="mx-auto flex w-full max-w-none items-center justify-between gap-3 px-3 py-3 md:px-6">
        <p className="text-sm font-semibold text-primary md:text-base">
          Lab Booking System
        </p>

        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              accountActive
                ? "border-primary bg-primary text-white"
                : "border-border-light bg-white text-text-main hover:bg-background-main"
            }`}
          >
            Account
          </Link>

          <Link
            href="/lab-booking"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              labBooking
                ? "border-primary bg-primary text-white"
                : "border-border-light bg-white text-text-main hover:bg-background-main"
            }`}
          >
            Lab Booking
          </Link>
          <Link
            href="/equipment-booking"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              equipmentBooking
                ? "border-primary bg-primary text-white"
                : "border-border-light bg-white text-text-main hover:bg-background-main"
            }`}
          >
            Equipment Booking
          </Link>
          <Link
            href="/booking-records"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              bookingRecordsActive
                ? "border-primary bg-primary text-white"
                : "border-border-light bg-white text-text-main hover:bg-background-main"
            }`}
          >
            Booking Records
          </Link>

          {hasActiveVerification ? (
            <span className="rounded-full border border-green-300 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
              Verified
            </span>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
