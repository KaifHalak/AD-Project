"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;

function getRecoveryParamsFromHash() {
  if (typeof window === "undefined") {
    return {
      type: "",
      accessToken: "",
      refreshToken: "",
      errorDescription: "",
    };
  }

  const hashContent = window.location.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hashContent);

  return {
    type: hashParams.get("type") || "",
    accessToken: hashParams.get("access_token") || "",
    refreshToken: hashParams.get("refresh_token") || "",
    errorDescription: hashParams.get("error_description") || "",
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [isRecoveryAccessAllowed, setIsRecoveryAccessAllowed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function verifyRecoveryLink() {
      setIsCheckingLink(true);
      setErrorMessage("");

      const { type, accessToken, refreshToken, errorDescription } =
        getRecoveryParamsFromHash();

      if (!isMounted) {
        return;
      }

      if (errorDescription) {
        router.replace("/");
        return;
      }

      if (type !== "recovery" || !accessToken || !refreshToken) {
        router.replace("/");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!isMounted) {
        return;
      }

      if (error) {
        router.replace("/");
        return;
      }

      window.history.replaceState({}, document.title, window.location.pathname);

      setIsRecoveryAccessAllowed(true);
      setIsCheckingLink(false);
    }

    verifyRecoveryLink();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleResetPassword(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!isRecoveryAccessAllowed) {
      router.replace("/");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Please enter and confirm your new password.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMessage(error.message || "Could not update password.");
        return;
      }

      setSuccessMessage(
        "Password updated successfully. Redirecting to login...",
      );

      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push("/");
      }, 1200);
    } catch {
      setErrorMessage("Server error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-main px-4 py-10">
      <Card className="border-[3px] md:p-10">
        {isCheckingLink ? (
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold text-primary">
              Reset Password
            </h1>
            <p className="text-sm text-text-muted">Validating reset link...</p>
          </div>
        ) : null}

        {!isCheckingLink && isRecoveryAccessAllowed ? (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-semibold text-primary">
                Reset Password
              </h1>
              <p className="mt-2 text-sm text-text-muted">
                Enter your new password below
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
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

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Password"}
            </Button>
          </form>
        ) : null}
      </Card>
    </main>
  );
}
