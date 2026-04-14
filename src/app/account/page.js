"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Loader from "@/components/loader";
import { getCurrentUser, signOutUser } from "@/lib/supabase/auth";
import { getRecordByColumn } from "@/lib/supabase/db";

export default function AccountPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [accountData, setAccountData] = useState(null);

  useEffect(() => {
    let isMounted = true;

    loadAccountDetails();

    return () => {
      isMounted = false;
    };

    /**
     * Checks authentication and then loads account details from the users table.
     * The loader stays visible until this entire flow completes.
     */
    async function loadAccountDetails() {
      setErrorMessage("");
      setIsLoading(true);

      try {
        const { data: authData, error: authError } = await getCurrentUser();

        if (!isMounted) {
          return;
        }

        if (authError) {
          setErrorMessage(
            "Error checking authentication. Please log in again.",
          );
          return;
        }

        if (!authData?.user) {
          router.push("/");
          return;
        }

        const { data, error } = await getRecordByColumn(
          "users",
          "email",
          authData.user.email,
          "username, email, role",
        );

        if (!isMounted) {
          return;
        }

        if (error) {
          setErrorMessage("Could not load account details from users table.");
          return;
        }

        if (!data) {
          setErrorMessage("No account details found for this user.");
          return;
        }

        setAccountData(data);
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setErrorMessage("Server error while loading account details.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
  }, [router]);

  /**
   * Logs the user out of Supabase and sends them back to the login page.
   * If logout fails, a message is shown.
   */
  async function handleLogout() {
    setErrorMessage("");

    try {
      setIsLoggingOut(true);
      const { error } = await signOutUser();

      if (error) {
        setErrorMessage("Could not log out. Please try again.");
        return;
      }

      router.push("/");
    } catch {
      setErrorMessage("Server error while logging out.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (isLoading) {
    return <Loader />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-main px-4 py-10">
      <Card className="w-full max-w-2xl border-[3px] md:p-10">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-primary">My Account</h1>
            <p className="mt-2 text-sm text-text-muted">
              Basic details from the users table
            </p>
          </div>

          {errorMessage ? (
            <p className="rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
              {errorMessage}
            </p>
          ) : null}

          {accountData && !isLoading ? (
            <div className="space-y-4 rounded-xl border border-border-light bg-white p-4">
              <div className="space-y-1">
                <Label>Username</Label>
                <p className="text-base text-text-main">
                  {accountData.username || "-"}
                </p>
              </div>

              <div className="space-y-1">
                <Label>Email</Label>
                <p className="text-base text-text-main">
                  {accountData.email || "-"}
                </p>
              </div>

              <div className="space-y-1">
                <Label>Role</Label>
                <p className="text-base text-text-main">
                  {accountData.role || "-"}
                </p>
              </div>
            </div>
          ) : null}

          <Button onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "Logging out..." : "Log out"}
          </Button>

          {accountData?.role === "pic" ? (
            <Button
              variant="secondary"
              onClick={() => router.push("/account/token-generation")}
            >
              Go to Token Generation
            </Button>
          ) : null}

          {accountData?.role === "pic" ? (
            <Button
              variant="secondary"
              onClick={() => router.push("/account/assigned-tokens")}
            >
              View Assigned Tokens
            </Button>
          ) : null}

          {!isLoading && errorMessage.includes("No active session") ? (
            <Button variant="secondary" onClick={() => router.push("/")}>
              Back to Login
            </Button>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
