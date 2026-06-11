"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentSession, getCurrentUser } from "@/lib/supabase/auth";
import { getRecordByColumn } from "@/lib/supabase/db";
import { fetchVerificationStatus } from "@/lib/verificationClient";
import { getStoredBookingRequestItems } from "@/lib/bookingRequest";

export default function AppNavbar() {
  const pathname = usePathname();
  const [hasActiveVerification, setHasActiveVerification] = useState(false);
  const [role, setRole] = useState("");
  const [bookingRequestCount, setBookingRequestCount] = useState(0);

  const accountActive = pathname.startsWith("/account");
  const ppmuActive = pathname.startsWith("/PPMU");
  const unitLeaderActive = pathname.startsWith("/unit-leader");
  const bookingActive = pathname.startsWith("/booking");
  const completeBookingActive = pathname.startsWith("/complete-booking");
  const bookingRecordsActive = pathname.startsWith("/booking-records");

  useEffect(() => {
    let isMounted = true;

    if (pathname === "/") {
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
          setRole("");
          return;
        }

        const accessToken = sessionData.session.access_token;
        const [verificationResponse, authResult] = await Promise.all([
          fetchVerificationStatus(accessToken),
          getCurrentUser(),
        ]);

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

        if (authResult.error || !authResult.data?.user?.email) {
          setRole("");
          return;
        }

        const { data: profile, error: profileError } = await getRecordByColumn(
          "users",
          "email",
          authResult.data.user.email,
          "role",
        );

        if (!isMounted) {
          return;
        }

        if (profileError || !profile) {
          setRole("");
          return;
        }

        setRole(profile.role || "");
      } catch {
        if (isMounted) {
          setHasActiveVerification(false);
          setRole("");
        }
      }
    }

    refreshVerificationBadge();

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  useEffect(() => {
    function refreshBookingRequestCount() {
      setBookingRequestCount(getStoredBookingRequestItems().length);
    }

    refreshBookingRequestCount();
    window.addEventListener("booking-request-updated", refreshBookingRequestCount);
    window.addEventListener("storage", refreshBookingRequestCount);

    return () => {
      window.removeEventListener(
        "booking-request-updated",
        refreshBookingRequestCount,
      );
      window.removeEventListener("storage", refreshBookingRequestCount);
    };
  }, []);

  // Keep login and registration screens focused by hiding global navigation.
  if (pathname === "/" || pathname === "/register") {
    return null;
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

          {role === "ppmu" ? (
            <Link
              href="/PPMU"
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                ppmuActive
                  ? "border-primary bg-primary text-white"
                  : "border-border-light bg-white text-text-main hover:bg-background-main"
              }`}
            >
              PPMU
            </Link>
          ) : null}

          {role === "unit_leader" ? (
            <Link
              href="/unit-leader"
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                unitLeaderActive
                  ? "border-primary bg-primary text-white"
                  : "border-border-light bg-white text-text-main hover:bg-background-main"
              }`}
            >
              Unit Leader
            </Link>
          ) : null}

          <Link
            href="/booking"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              bookingActive && !bookingRecordsActive
                ? "border-primary bg-primary text-white"
                : "border-border-light bg-white text-text-main hover:bg-background-main"
            }`}
          >
            Booking
          </Link>
          <Link
            href="/complete-booking"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              completeBookingActive
                ? "border-primary bg-primary text-white"
                : "border-border-light bg-white text-text-main hover:bg-background-main"
            }`}
          >
            Complete Booking
            {bookingRequestCount > 0 ? (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  completeBookingActive
                    ? "bg-white text-primary"
                    : "bg-primary text-white"
                }`}
              >
                {bookingRequestCount}
              </span>
            ) : null}
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
