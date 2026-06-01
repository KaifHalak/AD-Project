"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { formatRmFromUsd } from "@/lib/currency";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

function getUniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
}

function getStatusStyle(status) {
  switch (status) {
    case "available":
      return "border-green-200 bg-green-50 text-green-700";
    case "in_use":
      return "border-primary/20 bg-white text-primary";
    case "maintenance":
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    default:
      return "border-border-light bg-white text-text-muted";
  }
}

function getStatusText(status) {
  switch (status) {
    case "available":
      return "AVAILABLE";
    case "in_use":
      return "IN USE";
    case "maintenance":
      return "MAINTENANCE";
    default:
      return status || "UNKNOWN";
  }
}

export default function LabBookingPage() {
  const router = useRouter();
  const [labs, setLabs] = useState([]);
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("All Courses");
  const [location, setLocation] = useState("All Locations");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    async function loadLabs() {
      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("labs")
        .select("id, name, description, location, status, price_per_hour, course")
        .order("name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error(error);
        setErrorMessage("Could not load labs.");
        setLabs([]);
      } else {
        setLabs(data || []);
      }

      setIsLoading(false);
    }

    loadLabs();

    return () => {
      isMounted = false;
    };
  }, []);

  const courses = useMemo(() => getUniqueValues(labs, "course"), [labs]);
  const locations = useMemo(() => getUniqueValues(labs, "location"), [labs]);
  const keyword = search.trim().toLowerCase();
  const filteredLabs = labs.filter((lab) => {
    const matchesSearch =
      lab.name?.toLowerCase().includes(keyword) ||
      lab.id?.toLowerCase().includes(keyword);
    const matchesCourse = course === "All Courses" || lab.course === course;
    const matchesLocation =
      location === "All Locations" || lab.location === location;

    return matchesSearch && matchesCourse && matchesLocation;
  });

  function handleBooking(lab) {
    if (lab.status === "maintenance") return;
    router.push(`/lab-booking/${encodeURIComponent(lab.id)}`);
  }

  return (
    <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
      <section className="min-h-[calc(100vh-7rem)] w-full rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-primary">Lab Catalog</h1>
            <p className="mt-2 text-sm text-text-muted">
              Browse, filter, and choose a lab to start your booking.
            </p>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4 text-sm text-text-muted md:p-5">
            <p className="font-semibold text-primary">How lab booking works</p>
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <p>1. Select a lab to view details and availability.</p>
              <p>2. Choose one day or a range up to 2 weeks.</p>
              <p>3. Enter the PIC token assigned to your account.</p>
              <p>4. Check Booking Records for approval status.</p>
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4 md:p-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <Input
                type="search"
                aria-label="Search labs"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="md:min-w-80"
                placeholder="Search by lab name or ID..."
              />

              <select
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-sm text-text-main outline-none transition-colors focus:border-primary md:w-60"
              >
                <option>All Courses</option>
                {courses.map((courseOption) => (
                  <option key={courseOption}>{courseOption}</option>
                ))}
              </select>

              <select
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-sm text-text-main outline-none transition-colors focus:border-primary md:w-60"
              >
                <option>All Locations</option>
                {locations.map((locationOption) => (
                  <option key={locationOption}>{locationOption}</option>
                ))}
              </select>
            </div>
          </div>

          {errorMessage ? (
            <p className="rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
              {errorMessage}
            </p>
          ) : null}

          {isLoading ? (
            <p className="rounded-lg border border-border-light bg-white px-3 py-4 text-sm text-text-muted">
              Loading labs...
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                Showing {filteredLabs.length} lab{filteredLabs.length === 1 ? "" : "s"}
              </p>

              {filteredLabs.length === 0 ? (
                <p className="rounded-lg border border-border-light bg-white px-3 py-4 text-sm text-text-muted">
                  No labs found.
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredLabs.map((lab) => {
                  const isUnderMaintenance = lab.status === "maintenance";

                  return (
                    <button
                      type="button"
                      key={lab.id}
                      onClick={() => handleBooking(lab)}
                      disabled={isUnderMaintenance}
                      className={`h-full rounded-xl border border-border-light bg-white p-4 text-left transition-colors focus:border-primary focus:outline-none md:p-5 ${
                        isUnderMaintenance
                          ? "cursor-not-allowed opacity-70"
                          : "hover:border-primary"
                      }`}
                    >
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/10 bg-background-main text-sm font-semibold text-primary">
                          LAB
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle(
                            lab.status,
                          )}`}
                        >
                          {getStatusText(lab.status)}
                        </span>
                      </div>

                      <h2 className="text-xl font-semibold text-text-main">
                        {lab.name}
                      </h2>
                      <p className="mb-3 text-sm text-text-muted">ID: {lab.id}</p>
                      <p className="mb-4 text-sm leading-relaxed text-text-muted">
                        {lab.description || "No description provided."}
                      </p>

                      <div className="mb-4 space-y-2 text-sm text-text-muted">
                        <p>{lab.course || "-"}</p>
                        <p>{lab.location || "-"}</p>
                      </div>

                      <hr className="my-4 border-border-light" />

                      <p className="text-xs font-semibold tracking-wide text-text-muted">
                        EST. PRICE
                      </p>
                      <p className="text-xl font-semibold text-primary">
                        {formatRmFromUsd(lab.price_per_hour)}/hr
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
