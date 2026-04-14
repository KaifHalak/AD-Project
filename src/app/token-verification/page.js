"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentSession } from "@/lib/supabase/auth";

export default function TokenVerificationPage() {
  const router = useRouter();

  const [picCode, setPicCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleVerify(event) {
    event.preventDefault();

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

      setSuccessMessage(
        "Code verified successfully. Redirecting to booking page...",
      );
      setTimeout(() => {
        router.push("/booking");
      }, 900);
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while verifying code.");
    } finally {
      setIsVerifying(false);
    }
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

          <Button type="submit" disabled={isVerifying}>
            {isVerifying ? "Verifying..." : "Verify"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
