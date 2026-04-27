"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

const START_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

function formatDateForDB(date) {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function addHour(time) {
  const hour = Number(time.split(":")[0]) + 1;
  return `${String(hour).padStart(2, "0")}:00`;
}

function normalizeTime(time) {
  return (time || "").slice(0, 5);
}

function getSlotBooking(bookings, labId, startTime, endTime) {
  return bookings.find((booking) => {
    if (
      booking.lab_id !== labId ||
      !["pending", "approved"].includes(booking.status)
    ) {
      return false;
    }

    return (
      startTime < normalizeTime(booking.end_time) &&
      endTime > normalizeTime(booking.start_time)
    );
  });
}

function getSlotStatus(booking) {
  if (!booking) {
    return "available";
  }

  if (booking.status === "pending") {
    return "pending";
  }

  return "approved";
}

export default function LabBookingPage() {
  const router = useRouter();
  const dropdownRef = useRef(null);

  const [labs, setLabs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedLabIds, setSelectedLabIds] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedDateString = formatDateForDB(selectedDate);
  const visibleLabs = selectedLabIds.length
    ? labs.filter((lab) => selectedLabIds.includes(lab.id))
    : labs;

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    async function loadLabs() {
      setErrorMessage("");

      const { data, error } = await supabase
        .from("labs")
        .select("id, name, description, location, status, price_per_hour, course")
        .order("name", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error(error);
        setErrorMessage("Could not load labs.");
        setLabs([]);
        return;
      }

      setLabs(data || []);
    }

    loadLabs();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    async function loadBookings() {
      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("lab_bookings")
        .select("id, lab_id, user_id, booking_date, start_time, end_time, status")
        .eq("booking_date", selectedDateString);

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error(error);
        setErrorMessage("Could not load lab bookings.");
        setBookings([]);
      } else {
        setBookings(data || []);
      }

      setIsLoading(false);
    }

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, [selectedDateString]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function changeDate(days) {
    setSelectedDate((current) => {
      const nextDate = new Date(current);
      nextDate.setDate(current.getDate() + days);
      return nextDate;
    });
  }

  function getFilterLabel() {
    if (selectedLabIds.length === 0) {
      return "Labs: Show All";
    }

    if (selectedLabIds.length === 1) {
      const selectedLab = labs.find((lab) => lab.id === selectedLabIds[0]);
      return `Labs: ${selectedLab?.name || "1 Lab"}`;
    }

    return `Labs: ${selectedLabIds.length} Labs Selected`;
  }

  function toggleLab(labId) {
    setSelectedLabIds((current) =>
      current.includes(labId)
        ? current.filter((selectedId) => selectedId !== labId)
        : [...current, labId],
    );
  }

  function handleSlotClick(labId, startTime) {
    const endTime = addHour(startTime);
    router.push(
      `/lab-booking/${labId}?date=${selectedDateString}&start=${startTime}&end=${endTime}`,
    );
  }

  return (
    <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
      <section className="min-h-[calc(100vh-7rem)] rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-primary">Book a Lab</h1>
              <p className="mt-2 text-sm text-text-muted">
                Select an available time slot to start your booking.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-300" />
                Available
              </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-primary/40" />
                Approved
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-purple-300" />
                Pending
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => changeDate(-1)}
                  className="h-10 w-10 px-0"
                  aria-label="Previous day"
                >
                  &lt;
                </Button>

                <h2 className="text-xl font-semibold text-text-main">
                  {formatDisplayDate(selectedDate)}
                </h2>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => changeDate(1)}
                  className="h-10 w-10 px-0"
                  aria-label="Next day"
                >
                  &gt;
                </Button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative" ref={dropdownRef}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsDropdownOpen((current) => !current)}
                    className="justify-between sm:w-64"
                  >
                    {getFilterLabel()}
                    <span className="ml-2 text-xs">v</span>
                  </Button>

                  {isDropdownOpen ? (
                    <div className="absolute right-0 z-50 mt-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-border-light bg-white p-2 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedLabIds([])}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text-main hover:bg-background-main"
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded border ${
                            selectedLabIds.length === 0
                              ? "border-primary bg-primary text-white"
                              : "border-border-light bg-white"
                          }`}
                        >
                          {selectedLabIds.length === 0 ? "x" : ""}
                        </span>
                        Show All
                      </button>

                      <div className="my-2 border-t border-border-light" />

                      {labs.map((lab) => {
                        const checked = selectedLabIds.includes(lab.id);
                        return (
                          <button
                            type="button"
                            key={lab.id}
                            onClick={() => toggleLab(lab.id)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text-main hover:bg-background-main"
                          >
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded border ${
                                checked
                                  ? "border-primary bg-primary text-white"
                                  : "border-border-light bg-white"
                              }`}
                            >
                              {checked ? "x" : ""}
                            </span>
                            {lab.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedDate(new Date())}
                  className="w-auto"
                >
                  Today
                </Button>

                <Input
                  type="date"
                  value={selectedDateString}
                  onChange={(event) =>
                    event.target.value &&
                    setSelectedDate(new Date(`${event.target.value}T00:00:00`))
                  }
                  onClick={(event) => event.target.showPicker?.()}
                  className="cursor-pointer sm:w-44"
                />
              </div>
            </div>

            {errorMessage ? (
              <p className="mt-4 rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
                {errorMessage}
              </p>
            ) : null}

            {isLoading ? (
              <p className="mt-6 text-sm text-text-muted">Loading timetable...</p>
            ) : null}

            {!isLoading ? (
              <div className="mt-6 overflow-x-auto pb-2">
                <div className="min-w-[1180px]">
                  <div className="grid grid-cols-[150px_repeat(10,1fr)] gap-3 border-b border-border-light pb-3 text-sm font-semibold text-text-main">
                    <div className="text-xs uppercase tracking-wide text-text-muted">
                      Lab Resource
                    </div>
                    {START_TIMES.map((time) => (
                      <div key={time} className="text-center">
                        {time}
                      </div>
                    ))}
                  </div>

                  <div className="divide-y divide-border-light">
                    {visibleLabs.map((lab) => (
                      <div
                        key={lab.id}
                        className="grid grid-cols-[150px_repeat(10,1fr)] items-center gap-3 py-4"
                      >
                        <div>
                          <p className="font-semibold text-text-main">
                            {lab.name}
                          </p>
                          <p className="text-sm text-text-muted">
                            {lab.location || "-"}
                          </p>
                        </div>

                        {START_TIMES.map((startTime) => {
                          const endTime = addHour(startTime);
                          const booking = getSlotBooking(
                            bookings,
                            lab.id,
                            startTime,
                            endTime,
                          );
                          const status = getSlotStatus(booking);

                          if (status === "available") {
                            return (
                              <button
                                type="button"
                                key={`${lab.id}-${startTime}`}
                                onClick={() => handleSlotClick(lab.id, startTime)}
                                className="flex h-20 flex-col items-center justify-center rounded-xl border border-green-200 bg-green-50 px-2 text-center text-xs font-semibold text-green-700 transition-colors hover:border-primary hover:bg-background-main focus:border-primary focus:outline-none"
                              >
                                Click to Book
                              </button>
                            );
                          }

                          return (
                            <div
                              key={`${lab.id}-${startTime}`}
                              className={`flex h-20 flex-col items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold ${
                                status === "pending"
                                  ? "border-purple-200 bg-purple-50 text-purple-700"
                                  : "border-primary/20 bg-white text-primary"
                              }`}
                            >
                              <span>
                                {status === "pending" ? "Pending" : "Approved"}
                              </span>
                              <span className="mt-1 text-[11px] font-normal text-text-muted">
                                {status === "pending"
                                  ? "Awaiting approval"
                                  : "Unavailable"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {visibleLabs.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-border-light bg-white px-3 py-4 text-sm text-text-muted">
                      No labs found.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border-light bg-white px-4 py-3 text-sm text-text-muted">
            Click any available lab time slot to start your booking.
          </div>
        </div>
      </section>
    </main>
  );
}
