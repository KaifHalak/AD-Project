"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const REQUIRED_EMAIL_SUFFIX = "@graduate.utm.my";

async function requestPasswordReset(email) {
  const response = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  return {
    ok: response.ok,
    data,
  };
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Please enter your email.");
      return;
    }

    if (!normalizedEmail.endsWith(REQUIRED_EMAIL_SUFFIX)) {
      setErrorMessage(`Email must end with ${REQUIRED_EMAIL_SUFFIX}.`);
      return;
    }

    try {
      setIsLoading(true);

      const response = await requestPasswordReset(normalizedEmail);

      if (!response.ok) {
        setErrorMessage(response.data?.error || "Could not send reset email.");
        return;
      }

      setSuccessMessage(
        response.data?.message ||
          "If your account exists, a password reset email has been sent.",
      );
    } catch {
      setErrorMessage("Server error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-main px-4 py-10">
      <Card className="border-[3px] md:p-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-primary">
              Forgot Password
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Enter your email and we&apos;ll send a reset link
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Sending..." : "Send Reset Email"}
          </Button>

          <p className="text-center text-sm text-text-muted">
            Remembered your password?{" "}
            <Link
              href="/"
              className="font-semibold text-primary hover:text-primary-hover"
            >
              Back to login
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}
