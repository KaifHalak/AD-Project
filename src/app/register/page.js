"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const REQUIRED_EMAIL_SUFFIX = "@graduate.utm.my";

const ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "staff", label: "Staff" },
];

async function registerWithEmailPassword({ username, email, password, role }) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, email, password, role }),
  });

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleRegister(event) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const payload = {
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
    };

    if (
      !payload.username ||
      !payload.email ||
      !payload.password ||
      !payload.role
    ) {
      setErrorMessage("Please fill in all fields.");
      return;
    }

    if (!payload.email.endsWith(REQUIRED_EMAIL_SUFFIX)) {
      setErrorMessage(`Email must end with ${REQUIRED_EMAIL_SUFFIX}.`);
      return;
    }

    try {
      setIsLoading(true);
      const response = await registerWithEmailPassword(payload);

      if (!response.ok) {
        setErrorMessage(response.data?.error || "Could not register account.");
        return;
      }

      setSuccessMessage(
        "Account created successfully. Redirecting to login...",
      );

      setTimeout(() => {
        router.push("/");
      }, 1200);
    } catch {
      setErrorMessage("Server error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-main px-4 py-10">
      <Card className="border-[3px] md:p-10">
        <form onSubmit={handleRegister} className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-primary">
              Lab Booking System
            </h1>
            <p className="mt-2 text-sm text-text-muted">Create a new account</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <p className="text-xs text-text-muted">
              Use your <span className="font-semibold">@graduate.utm.my </span>
              email address.
            </p>
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

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-text-main outline-none transition-colors focus:border-primary"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-muted">
              PIC accounts are assigned by the system administrator after your
              account is created.
            </p>
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
            {isLoading ? "Creating account..." : "Register"}
          </Button>

          <p className="text-center text-sm text-text-muted">
            Already have an account?{" "}
            <Link
              href="/"
              className="font-semibold text-primary hover:text-primary-hover"
            >
              Login
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}
