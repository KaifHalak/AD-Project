"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Loader from "@/components/loader";
import { getCurrentUser, signOutUser } from "@/lib/supabase/auth";
import { getRecordByColumn } from "@/lib/supabase/db";

function SidebarLink({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
        active
          ? "border-primary bg-transparent text-primary"
          : "border-transparent bg-transparent text-text-main hover:border-border-light"
      }`}
    >
      {children}
    </button>
  );
}

export default function AccountLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSidebarRole() {
      setIsLoading(true);

      try {
        const { data: authData, error: authError } = await getCurrentUser();

        if (!isMounted) {
          return;
        }

        if (authError || !authData?.user?.email) {
          router.push("/");
          return;
        }

        const { data: profile, error: profileError } = await getRecordByColumn(
          "users",
          "email",
          authData.user.email,
          "role",
        );

        if (!isMounted) {
          return;
        }

        if (profileError || !profile) {
          router.push("/");
          return;
        }

        setRole(profile.role || "");
      } catch {
        if (isMounted) {
          router.push("/");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSidebarRole();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await signOutUser();
      router.push("/");
    } catch {
      router.push("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (isLoading) {
    return <Loader />;
  }

  return (
    <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
      <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4 md:flex-row">
        <aside className="w-full shrink-0 rounded-2xl border border-border-light bg-panel p-4 md:w-64">
          <div className="flex h-full min-h-64 flex-col">
            <div className="space-y-2">
              <SidebarLink
                active={pathname === "/account"}
                onClick={() => router.push("/account")}
              >
                Account
              </SidebarLink>

              {role === "pic" ? (
                <SidebarLink
                  active={pathname.startsWith("/account/token-generation")}
                  onClick={() => router.push("/account/token-generation")}
                >
                  Generate Token
                </SidebarLink>
              ) : null}

              {role === "pic" ? (
                <SidebarLink
                  active={pathname.startsWith("/account/assigned-tokens")}
                  onClick={() => router.push("/account/assigned-tokens")}
                >
                  View Assigned Tokens
                </SidebarLink>
              ) : null}
            </div>

            <div className="mt-4 md:mt-auto">
              <Button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="h-10 w-full rounded-lg text-sm"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </Button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}
