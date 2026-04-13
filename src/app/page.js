"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

async function loginWithEmailPassword(email, password) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Submits login details to the API and redirects to accounts page on success.
   * Any API or server error is shown clearly to the user.
   */
  async function handleLogin(event) {
    event.preventDefault();
    setErrorMessage("");

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await loginWithEmailPassword(email, password);

      if (!response.ok) {
        if (response.status === 401) {
          setErrorMessage("Invalid email or password.");
        } else {
          setErrorMessage(
            response.data?.error || "Server error. Please try again.",
          );
        }
        return;
      }

      const accessToken = response.data?.session?.access_token;
      const refreshToken = response.data?.session?.refresh_token;

      if (!accessToken || !refreshToken) {
        setErrorMessage("Login succeeded but no session was returned.");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        setErrorMessage("Could not create local session. Please try again.");
        return;
      }

      router.push("/account");
    } catch {
      setErrorMessage("Server error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-main px-4 py-10">
      <Card className="border-[3px] md:p-10">
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-primary">
              Lab Booking System
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Sign in with your university account
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

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
