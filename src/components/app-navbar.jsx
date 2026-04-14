"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppNavbar() {
  const pathname = usePathname();

  // Keep the login screen focused by hiding global navigation on root route.
  if (pathname === "/") {
    return null;
  }

  const accountActive = pathname.startsWith("/account");
  const bookingActive = pathname.startsWith("/booking");

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
            href="/booking"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              bookingActive
                ? "border-primary bg-primary text-white"
                : "border-border-light bg-white text-text-main hover:bg-background-main"
            }`}
          >
            Booking
          </Link>
        </div>
      </nav>
    </header>
  );
}
