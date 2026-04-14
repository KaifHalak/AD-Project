"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentSession } from "@/lib/supabase/auth";
import { fetchVerificationStatus } from "@/lib/verificationClient";

const REDIRECT_SECONDS = 10;

function formatDateTime(dateISOString) {
  return new Date(dateISOString).toLocaleString();
}

export default function TokenVerificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  const [picCode, setPicCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(REDIRECT_SECONDS);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasVerifiedSuccessfully, setHasVerifiedSuccessfully] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const redirectPath = searchParams.get("redirect") || "/booking";

  function stopRedirectTimers() {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }

  function redirectNow() {
    stopRedirectTimers();
    router.push(redirectPath);
  }

  useEffect(() => {
    let isMounted = true;

    async function checkExistingVerification() {
      try {
        const { data: sessionData } = await getCurrentSession();

        if (!isMounted) {
          return;
        }

        if (!sessionData?.session) {
          setIsCheckingAccess(false);
          return;
        }

        const accessToken = sessionData.session.access_token;
        const verificationResponse = await fetchVerificationStatus(accessToken);

        if (!isMounted) {
          return;
        }

        if (!verificationResponse.ok) {
          setIsCheckingAccess(false);
          return;
        }

        if (
          verificationResponse.data?.verified ||
          verificationResponse.data?.bypassVerification
        ) {
          router.push(redirectPath);
          return;
        }

        setIsCheckingAccess(false);
      } catch {
        if (isMounted) {
          setIsCheckingAccess(false);
        }
      }
    }

    checkExistingVerification();

    return () => {
      isMounted = false;
      stopRedirectTimers();
    };
  }, [redirectPath, router]);

  async function handleVerify(event) {
    event.preventDefault();

    if (hasVerifiedSuccessfully) {
      return;
    }

    stopRedirectTimers();
    setIsCountdownActive(false);
    setCountdownSeconds(REDIRECT_SECONDS);
    setHasVerifiedSuccessfully(false);
    setErrorMessage("");
    setSuccessMessage("");

    const formattedCode = picCode.trim().toUpperCase();

    if (!formattedCode) {
      setErrorMessage("Please enter a PIC code.");
      return;
    }

    try {
      setIsVerifying(true);

      const { data: sessionData } = await getCurrentSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setErrorMessage("Please log in first to verify your PIC code.");
        return;
      }

      const response = await fetch("/api/tokens/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ picCode: formattedCode }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setErrorMessage(responseData?.error || "Could not verify code.");
        return;
      }

      if (responseData?.bypassVerification) {
        setHasVerifiedSuccessfully(true);
        setSuccessMessage("PIC access confirmed. Redirecting to booking...");
        redirectTimerRef.current = setTimeout(() => {
          redirectNow();
        }, 600);
        return;
      }

      const expiresAt = responseData?.expiresAt;

      if (!expiresAt) {
        setErrorMessage("Code verified but verification details are missing.");
        return;
      }

      setHasVerifiedSuccessfully(true);
      setSuccessMessage(
        `Code verified successfully. It will expire on ${formatDateTime(expiresAt)}. Redirecting in ${REDIRECT_SECONDS} seconds.`,
      );

      setIsCountdownActive(true);
      setCountdownSeconds(REDIRECT_SECONDS);

      countdownTimerRef.current = setInterval(() => {
        setCountdownSeconds((current) => {
          if (current <= 1) {
            return 0;
          }

          return current - 1;
        });
      }, 1000);

      redirectTimerRef.current = setTimeout(() => {
        redirectNow();
      }, REDIRECT_SECONDS * 1000);
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while verifying code.");
    } finally {
      setIsVerifying(false);
    }
  }

  if (isCheckingAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background-main px-4 py-10">
        <Card className="w-full max-w-xl border-[3px] md:p-10">
          <p className="text-center text-sm text-text-muted">
            Checking verification status...
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-main px-4 py-10">
      <Card className="w-full max-w-xl border-[3px] md:p-10">
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-primary">
              Token Verification
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Enter your PIC code to verify and continue to booking.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="picCode">PIC code</Label>
            <Input
              id="picCode"
              type="text"
              value={picCode}
              onChange={(event) => setPicCode(event.target.value.toUpperCase())}
              maxLength={6}
            />
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

          {isCountdownActive ? (
            <div className="space-y-3 rounded-lg border border-green-200 bg-white p-3">
              <p className="text-sm font-medium text-green-700">
                Redirecting to booking in {countdownSeconds}s
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={redirectNow}
                className="h-10"
              >
                Redirect now
              </Button>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isVerifying || hasVerifiedSuccessfully}
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
