"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Loader from "@/components/loader";
import { AccountSessionProvider } from "./account-session-context";
import {
  getCurrentSession,
  getCurrentUser,
  signOutUser,
} from "@/lib/supabase/auth";
import { getRecordByColumn } from "@/lib/supabase/db";

const PIC_ONLY_ROUTES = [
  "/account/token-generation",
  "/account/assigned-tokens",
];

function isPicOnlyRoute(pathname) {
  return PIC_ONLY_ROUTES.some((route) => pathname.startsWith(route));
}

async function clearLocalAuthSession() {
  try {
    await signOutUser();
  } catch {
    // Ignore cleanup failures; redirecting to login is still the safest fallback.
  }
}

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
  const [accountSession, setAccountSession] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAccountSession() {
      setIsLoading(true);

      try {
        const { data: authData, error: authError } = await getCurrentUser();

        if (!isMounted) {
          return;
        }

        if (authError || !authData?.user?.email) {
          await clearLocalAuthSession();
          router.replace("/");
          return;
        }

        const { data: sessionData, error: sessionError } =
          await getCurrentSession();

        if (!isMounted) {
          return;
        }

        if (sessionError || !sessionData?.session?.access_token) {
          await clearLocalAuthSession();
          router.replace("/");
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

        const nextAccountSession = {
          user: authData.user,
          accessToken: sessionData.session.access_token,
          profile: profile || null,
          profileErrorMessage: "",
        };

        if (profileError) {
          nextAccountSession.profileErrorMessage =
            "Could not load account details from users table.";
        } else if (!profile) {
          nextAccountSession.profileErrorMessage =
            "No account details found for this user.";
        }

        setAccountSession(nextAccountSession);

        if (isPicOnlyRoute(pathname) && profile?.role !== "pic") {
          router.replace("/account");
          return;
        }
      } catch {
        if (isMounted) {
          await clearLocalAuthSession();
          router.replace("/");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAccountSession();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await signOutUser();
      router.replace("/");
    } catch {
      router.replace("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (isLoading) {
    return <Loader />;
  }

  if (!accountSession) {
    return <Loader />;
  }

  const role = accountSession.profile?.role || "";

  if (isPicOnlyRoute(pathname) && role !== "pic") {
    return <Loader />;
  }

  return (
    <AccountSessionProvider value={accountSession}>
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
    </AccountSessionProvider>
  );
}
