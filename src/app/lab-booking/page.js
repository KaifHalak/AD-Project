"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";
import {
  START_TIME_OPTIONS,
  formatDateInput,
  getAdjacentAllowedBookingDate,
  getDefaultBookingDateString,
  getMinBookingDate,
  getMinBookingDateString,
  isBookingDateAllowed,
  isWeekendDate,
  parseDateInput,
} from "@/lib/bookingConstraints";
import { getLabTimetableEvents } from "@/lib/mockTimetable";

const START_TIMES = START_TIME_OPTIONS;

function formatDateForDB(date) {
  return formatDateInput(date);
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
      !["pending", "approved", "class"].includes(booking.status)
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
  if (booking?.status === "class") {
    return "class";
  }

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
  const [selectedDate, setSelectedDate] = useState(
    parseDateInput(getDefaultBookingDateString()) || getMinBookingDate(),
  );
  const [selectedLabIds, setSelectedLabIds] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [localDateWarning, setLocalDateWarning] = useState("");

  const selectedDateString = formatDateForDB(selectedDate);
  const visibleLabs = selectedLabIds.length
    ? labs.filter((lab) => selectedLabIds.includes(lab.id))
    : labs;

  function applySelectedDate(nextDate) {
    if (!nextDate || Number.isNaN(nextDate.getTime())) {
      setLocalDateWarning(
        "Bookings must be at least 7 days in advance. Date adjusted automatically.",
      );
      setSelectedDate(getMinBookingDate());
      return;
    }

    if (!isBookingDateAllowed(nextDate)) {
      if (isWeekendDate(nextDate)) {
        setLocalDateWarning(
          "Weekends are not allowed. Date changed to the next valid weekday.",
        );
      } else {
        setLocalDateWarning(
          "Bookings must be at least 7 days in advance. Date adjusted automatically.",
        );
      }

      setSelectedDate(getAdjacentAllowedBookingDate(nextDate, 1));
      return;
    }

    setLocalDateWarning("");
    setSelectedDate(nextDate);
  }

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
        const timetableEvents = (labs || []).flatMap((lab) =>
          getLabTimetableEvents(lab.id, selectedDateString).map((event) => ({
            id: `class-${event.id}-${lab.id}`,
            lab_id: lab.id,
            status: "class",
            start_time: `${event.startTime}:00`,
            end_time: `${event.endTime}:00`,
            title: event.title,
          })),
        );

        setBookings([...(data || []), ...timetableEvents]);
      }

      setIsLoading(false);
    }

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, [labs, selectedDateString]);

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
    applySelectedDate(getAdjacentAllowedBookingDate(selectedDate, days));
  }

  function getFilterLabel() {
    if (selectedLabIds.length === 0) {
      return "All Labs";
    }

    if (selectedLabIds.length === 1) {
      const selectedLab = labs.find((lab) => lab.id === selectedLabIds[0]);
      return selectedLab?.name || "1 Lab";
    }

    return `${selectedLabIds.length} Labs`;
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
                Reserved
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-purple-300" />
                Pending
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4 text-sm text-text-muted md:p-5">
            <p className="font-semibold text-primary">How lab booking works</p>
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <p>1. Pick an available lab time slot.</p>
              <p>2. Enter the booking details and your research purpose.</p>
              <p>3. Ask the responsible PIC for a 6-character token.</p>
              <p>4. Track approval from Booking Records.</p>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Earliest booking date is 7 days from today.</li>
              <li>Weekends are not available for booking.</li>
              <li>Office hours only: 08:00 to 18:00.</li>
              <li>Class timetable slots are blocked automatically.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border-light bg-white px-4 py-3 text-sm text-text-muted">
            Click any available lab time slot to start your booking.
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => changeDate(-1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-light bg-transparent text-sm font-semibold text-text-main transition-colors hover:bg-white focus:border-primary focus:outline-none"
                  aria-label="Previous day"
                >
                  &lt;
                </button>

                <h2 className="text-xl font-semibold text-text-main">
                  {formatDisplayDate(selectedDate)}
                </h2>

                <button
                  type="button"
                  onClick={() => changeDate(1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-light bg-transparent text-sm font-semibold text-text-main transition-colors hover:bg-white focus:border-primary focus:outline-none"
                  aria-label="Next day"
                >
                  &gt;
                </button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen((current) => !current)}
                    className="flex h-9 min-w-32 items-center justify-between gap-2 rounded-lg border border-border-light bg-transparent px-3 text-xs font-semibold text-text-main transition-colors hover:bg-white focus:border-primary focus:outline-none"
                  >
                    <span className="max-w-36 truncate">{getFilterLabel()}</span>
                    <span className="ml-2 text-xs">v</span>
                  </button>

                  {isDropdownOpen ? (
                    <div className="absolute right-0 z-50 mt-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-border-light bg-white p-2 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedLabIds([])}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text-main hover:bg-background-main"
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded border ${selectedLabIds.length === 0
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
                              className={`flex h-5 w-5 items-center justify-center rounded border ${checked
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

                <button
                  type="button"
                  onClick={() =>
                    applySelectedDate(
                      parseDateInput(getDefaultBookingDateString()) ||
                      getMinBookingDate(),
                    )
                  }
                  className="h-9 rounded-lg border border-border-light bg-transparent px-3 text-xs font-semibold uppercase text-text-main transition-colors hover:bg-white focus:border-primary focus:outline-none"
                >
                  Earliest
                </button>

                <Input
                  type="date"
                  value={selectedDateString}
                  onChange={(event) =>
                    event.target.value &&
                    applySelectedDate(
                      parseDateInput(event.target.value) || selectedDate,
                    )
                  }
                  min={getMinBookingDateString()}
                  onClick={(event) => event.target.showPicker?.()}
                  className="h-9 cursor-pointer rounded-lg bg-transparent text-xs sm:w-40"
                />
              </div>
            </div>

            {localDateWarning ? (
              <p className="mt-4 rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
                {localDateWarning}
              </p>
            ) : null}

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
                <p className="mb-3 text-xs text-text-muted">
                  Tip: scroll sideways to view all time slots.
                </p>
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
                              className={`flex h-20 flex-col items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold ${status === "pending"
                                  ? "border-purple-200 bg-purple-50 text-purple-700"
                                  : status === "class"
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-primary/20 bg-white text-primary"
                                }`}
                            >
                              <span>
                                {status === "pending"
                                  ? "Pending"
                                  : status === "class"
                                    ? "Class"
                                    : "Reserved"}
                              </span>
                              <span className="mt-1 text-[11px] font-normal text-text-muted">
                                {status === "pending"
                                  ? "Awaiting approval"
                                  : status === "class"
                                    ? "Timetabled session"
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

        </div>
      </section>
    </main>
  );
}
