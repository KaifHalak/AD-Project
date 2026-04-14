"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";
import { fetchVerificationStatus } from "@/lib/verificationClient";

function formatDateTime(dateISOString) {
  return new Date(dateISOString).toLocaleString();
}

export default function BookingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [verifiedUntil, setVerifiedUntil] = useState("");
  const [isPicBypass, setIsPicBypass] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkBookingAccess() {
      setIsLoading(true);

      try {
        const { data: sessionData } = await getCurrentSession();

        if (!isMounted) {
          return;
        }

        if (!sessionData?.session) {
          router.push("/");
          return;
        }

        const accessToken = sessionData.session.access_token;
        const verificationResponse = await fetchVerificationStatus(accessToken);

        if (!isMounted) {
          return;
        }

        if (!verificationResponse.ok) {
          router.push("/token-verification?redirect=/booking");
          return;
        }

        if (verificationResponse.data?.bypassVerification) {
          setIsPicBypass(true);
          setVerifiedUntil("");
          return;
        }

        if (!verificationResponse.data?.verified) {
          router.push("/token-verification?redirect=/booking");
          return;
        }

        setIsPicBypass(false);
        setVerifiedUntil(verificationResponse.data?.expiresAt || "");
      } catch {
        if (isMounted) {
          router.push("/token-verification?redirect=/booking");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkBookingAccess();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isLoading) {
    return <Loader text="Checking booking access..." />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-main px-4 py-10">
      <section className="w-full max-w-3xl rounded-3xl border-2 border-border-light bg-panel p-8 text-center">
        <h1 className="text-3xl font-semibold text-primary">Booking Page</h1>
        {isPicBypass ? (
          <p className="mt-3 text-sm text-text-muted">
            PIC access: token verification is not required.
          </p>
        ) : null}
        {verifiedUntil ? (
          <p className="mt-3 text-sm text-text-muted">
            Verification active until {formatDateTime(verifiedUntil)}
          </p>
        ) : null}
      </section>
    </main>
  );
}
