"use client";

import { Label } from "@/components/ui/label";
import { useAccountSession } from "./account-session-context";

export default function AccountPage() {
  const { profile, profileErrorMessage } = useAccountSession();

  return (
    <section className="min-h-full w-full rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-primary">My Account</h1>
        </div>

        {profileErrorMessage ? (
          <p className="rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
            {profileErrorMessage}
          </p>
        ) : null}

        {profile ? (
          <div className="mx-auto w-full max-w-4xl space-y-4 rounded-xl border border-border-light bg-white p-4 md:p-6">
            <div className="space-y-1">
              <Label className="font-semibold">Username</Label>
              <p className="text-base text-text-main">
                {profile.username || "-"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Email</Label>
              <p className="text-base text-text-main">{profile.email || "-"}</p>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Role</Label>
              <p className="text-base text-text-main">{profile.role || "-"}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
