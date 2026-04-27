"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Loader from "@/components/loader";
import { getCurrentSession, getCurrentUser } from "@/lib/supabase/auth";
import { getRecordByColumn } from "@/lib/supabase/db";

const TOKEN_LENGTH = 6;
const TOKEN_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EXPIRY_DAYS_AHEAD = 7;

function generateToken(length = TOKEN_LENGTH) {
  let result = "";

  for (let i = 0; i < length; i += 1) {
    const randomIndex = Math.floor(Math.random() * TOKEN_CHARACTERS.length);
    result += TOKEN_CHARACTERS[randomIndex];
  }

  return result;
}

function formatExpiry(dateISOString) {
  return new Date(dateISOString).toLocaleString();
}

function getExpiryAtEndOfDay(daysAhead = EXPIRY_DAYS_AHEAD) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + daysAhead);
  expiryDate.setHours(23, 59, 59, 999);
  return expiryDate.toISOString();
}

export default function TokenGenerationPage() {
  const router = useRouter();

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isFindingUser, setIsFindingUser] = useState(false);
  const [isAssigningToken, setIsAssigningToken] = useState(false);

  const [accessToken, setAccessToken] = useState("");

  const [emailInput, setEmailInput] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [generatedTokenData, setGeneratedTokenData] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [findMessage, setFindMessage] = useState("");
  const [assignMessage, setAssignMessage] = useState("");
  const [assignErrorMessage, setAssignErrorMessage] = useState("");
  const [hasAssignedCurrentToken, setHasAssignedCurrentToken] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsPageLoading(true);
      setErrorMessage("");

      try {
        const { data: sessionData, error: sessionError } =
          await getCurrentSession();
        const { data: authData, error: authError } = await getCurrentUser();

        if (!isMounted) {
          return;
        }

        if (
          sessionError ||
          authError ||
          !sessionData?.session ||
          !authData?.user
        ) {
          router.push("/");
          return;
        }

        const { data: userProfile, error: profileError } =
          await getRecordByColumn(
            "users",
            "email",
            authData.user.email,
            "id, username, email, role",
          );

        if (!isMounted) {
          return;
        }

        if (profileError || !userProfile) {
          setErrorMessage("Could not load your account details.");
          return;
        }

        if (userProfile.role !== "pic") {
          router.push("/account");
          return;
        }

        setAccessToken(sessionData.session.access_token || "");
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setErrorMessage("Server error while loading this page.");
        }
      } finally {
        if (isMounted) {
          setIsPageLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const canGenerateToken = useMemo(() => !!foundUser, [foundUser]);
  const canAssign = useMemo(
    () => !!foundUser && !!generatedTokenData,
    [foundUser, generatedTokenData],
  );

  async function handleFindUser(event) {
    event.preventDefault();

    setFindMessage("");
    setAssignMessage("");
    setAssignErrorMessage("");
    setHasAssignedCurrentToken(false);
    setErrorMessage("");

    const normalizedEmail = emailInput.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Please enter the user email.");
      return;
    }

    if (!accessToken) {
      setErrorMessage("Your session is missing. Please log in again.");
      return;
    }

    try {
      setIsFindingUser(true);
      setFoundUser(null);
      setGeneratedTokenData(null);

      const response = await fetch("/api/pic/find-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setErrorMessage(responseData?.error || "Could not find user.");
        return;
      }

      setFoundUser(responseData.user);
      setFindMessage("User found successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while finding user.");
    } finally {
      setIsFindingUser(false);
    }
  }

  function handleGenerateToken() {
    setAssignMessage("");
    setAssignErrorMessage("");
    setHasAssignedCurrentToken(false);
    setErrorMessage("");

    if (!foundUser) {
      setErrorMessage("Find a user before generating a token.");
      return;
    }

    const expiresAt = getExpiryAtEndOfDay();

    setGeneratedTokenData({
      token: generateToken(TOKEN_LENGTH),
      expiresAt,
    });
  }

  async function handleAssignToken() {
    setAssignMessage("");
    setAssignErrorMessage("");
    setErrorMessage("");

    if (hasAssignedCurrentToken) {
      return;
    }

    if (!foundUser || !generatedTokenData) {
      setAssignErrorMessage("Find a user and generate a token first.");
      return;
    }

    if (!accessToken) {
      setAssignErrorMessage("Your session is missing. Please log in again.");
      return;
    }

    try {
      setIsAssigningToken(true);

      const response = await fetch("/api/pic/assign-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          token: generatedTokenData.token,
          expiresAt: generatedTokenData.expiresAt,
          assignedToUserId: foundUser.id,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setAssignErrorMessage(responseData?.error || "Could not assign token.");
        return;
      }

      setAssignMessage(
        `Token assigned successfully to ${foundUser.username || foundUser.email}.`,
      );
      setHasAssignedCurrentToken(true);
    } catch (error) {
      console.error(error);
      setAssignErrorMessage("Server error while assigning token.");
    } finally {
      setIsAssigningToken(false);
    }
  }

  if (isPageLoading) {
    return <Loader fullScreen={false} />;
  }

  return (
    <section className="min-h-full w-full rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-primary">
            Token Generation
          </h1>
          <p className="text-sm text-text-muted">
            Generate and assign booking tokens for students or staff.
          </p>
        </div>

        <div className="rounded-xl border border-border-light bg-white p-4 text-sm text-text-muted">
          <p className="font-semibold text-primary">PIC workflow</p>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <p>1. Search for the user by university email.</p>
            <p>2. Generate a 6-character token.</p>
            <p>3. Assign the token to that user.</p>
            <p>4. The user enters it during lab or equipment booking.</p>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
            {errorMessage}
          </p>
        ) : null}

        {findMessage ? (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {findMessage}
          </p>
        ) : null}

        {assignMessage ? (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {assignMessage}
          </p>
        ) : null}

        <form
          onSubmit={handleFindUser}
          className="space-y-4 rounded-xl border border-border-light bg-white p-4"
        >
          <div className="space-y-2">
            <Label htmlFor="targetEmail">User email</Label>
            <Input
              id="targetEmail"
              type="email"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
            />
          </div>

          <Button type="submit" disabled={isFindingUser}>
            {isFindingUser ? "Finding user..." : "Find user"}
          </Button>
        </form>

        {foundUser ? (
          <div className="space-y-4 rounded-xl border border-border-light bg-white p-4">
            <h2 className="text-lg font-semibold text-primary">User details</h2>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className={"font-semibold"}>Username</Label>
                <p className="text-base text-text-main">
                  {foundUser.username || "-"}
                </p>
              </div>
              <div className="space-y-1">
                <Label className={"font-semibold"}>Role</Label>
                <p className="text-base text-text-main">
                  {foundUser.role || "-"}
                </p>
              </div>
              <div className="space-y-1">
                <Label className={"font-semibold"}>Email</Label>
                <p className="break-all text-base text-text-main">
                  {foundUser.email || "-"}
                </p>
              </div>
            </div>

            <Button onClick={handleGenerateToken} disabled={!canGenerateToken}>
              Generate code
            </Button>
          </div>
        ) : null}

        {generatedTokenData ? (
          <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <h2 className="text-lg font-semibold text-green-800">
              Generated code
            </h2>

            <div className="space-y-2 text-sm text-green-900">
              <p>
                <span className="font-semibold">Code:</span>{" "}
                {generatedTokenData.token}
              </p>
              <p>
                <span className="font-semibold">Expires at:</span>{" "}
                {formatExpiry(generatedTokenData.expiresAt)}
              </p>
              <p>
                <span className="font-semibold">Username:</span>{" "}
                {foundUser?.username || "-"}
              </p>
              <p>
                <span className="font-semibold">Role:</span>{" "}
                {foundUser?.role || "-"}
              </p>
            </div>

            <Button
              onClick={handleAssignToken}
              disabled={
                !canAssign || isAssigningToken || hasAssignedCurrentToken
              }
            >
              {isAssigningToken ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Assigning...
                </span>
              ) : hasAssignedCurrentToken ? (
                "Assigned"
              ) : (
                "Assign"
              )}
            </Button>

            {assignMessage ? (
              <p className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-green-800">
                {assignMessage}
              </p>
            ) : null}

            {assignErrorMessage ? (
              <p className="rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
                {assignErrorMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-border-light bg-white p-4 text-sm text-text-main">
          <p className="font-semibold">Note:</p>
          <p>- The generated code is valid for 7 days.</p>
          <p>
            - The user can reuse this code for multiple bookings within those 7
            days.
          </p>
        </div>
      </div>
    </section>
  );
}
