"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import Loader from "@/components/loader";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getRecordByColumn } from "@/lib/supabase/db";

export default function AccountPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
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

  if (isLoading) {
    return <Loader fullScreen={false} />;
  }

  return (
    <section className="min-h-full w-full rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
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
          <div className="mx-auto w-full max-w-4xl space-y-4 rounded-xl border border-border-light bg-white p-4 md:p-6">
            <div className="space-y-1">
              <Label className="font-semibold">Username</Label>
              <p className="text-base text-text-main">
                {accountData.username || "-"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Email</Label>
              <p className="text-base text-text-main">
                {accountData.email || "-"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Role</Label>
              <p className="text-base text-text-main">
                {accountData.role || "-"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
