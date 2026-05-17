"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentSession, getCurrentUser } from "@/lib/supabase/auth";
import { getRecordByColumn } from "@/lib/supabase/db";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";
import { formatRmFromUsd } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  END_TIME_OPTIONS,
  START_TIME_OPTIONS,
  formatDateInput,
  getAdjacentAllowedBookingDate,
  getDefaultBookingDateString,
  getMinBookingDate,
  getMinBookingDateString,
  isBookingDateAllowed,
  isBookingDateStringAllowed,
  isOfficeTimeRange,
  isWeekendDate,
  parseDateInput,
  toMinutes,
} from "@/lib/bookingConstraints";
import {
  findEquipmentTimetableConflict,
  getEquipmentTimetableEvents,
} from "@/lib/mockTimetable";
import {
  MOCK_VOT_ACCOUNTS,
  MOCK_VOT_OPTIONS,
  validateMockVotFunding,
} from "@/lib/mockVotFunding";

export default function EquipmentBookingPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [equipment, setEquipment] = useState(null);
  const [bookings, setBookings] = useState([]);

  const [currentDate, setCurrentDate] = useState(
    parseDateInput(getDefaultBookingDateString()) || getMinBookingDate(),
  );

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");

  const [usage, setUsage] = useState("");
  const [projectGrantVotNo, setProjectGrantVotNo] = useState("");
  const [expenseVot, setExpenseVot] = useState("");
  const [token, setToken] = useState("");
  const [requesterRole, setRequesterRole] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const times = [...START_TIME_OPTIONS, "18:00"];
  const [localDateWarning, setLocalDateWarning] = useState("");
  const [rescheduleFromId, setRescheduleFromId] = useState("");

  const normalizeTime = (value) => String(value || "").slice(0, 5);
  const addHour = (time) => {
    const nextHour = Number(time.split(":")[0]) + 1;
    return `${String(nextHour).padStart(2, "0")}:00`;
  };
  const isEquipmentUnderMaintenance = equipment?.status === "maintenance";

  // ===== 日期处理 =====
  const formatDateForDB = (d) => formatDateInput(d);

  const formatDate = (d) =>
    d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

  const changeDate = (offset) => {
    setCurrentDate((current) => getAdjacentAllowedBookingDate(current, offset));
  };

  const applySampleVot = (account) => {
    setProjectGrantVotNo(account.grantNumber);
    setExpenseVot(account.votNumber);
    setErrorMessage("");
    setSuccessMessage("");
  };

  useEffect(() => {
    const rescheduleFrom = searchParams.get("rescheduleFrom") || "";
    const prefillDate = searchParams.get("date") || "";
    const prefillStart = searchParams.get("start") || "";
    const prefillEnd = searchParams.get("end") || "";

    if (rescheduleFrom) {
      setRescheduleFromId(rescheduleFrom);
    }

    if (prefillDate) {
      const parsed = parseDateInput(prefillDate);
      if (parsed) {
        setCurrentDate(parsed);
      }
    }

    if (START_TIME_OPTIONS.includes(prefillStart)) {
      setStartTime(prefillStart);
    }

    if (END_TIME_OPTIONS.includes(prefillEnd)) {
      setEndTime(prefillEnd);
    }
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;

    async function loadRequesterRole() {
      const { data: userData, error: userError } = await getCurrentUser();

      if (!isMounted || userError || !userData?.user?.email) {
        return;
      }

      const { data: profile, error: profileError } = await getRecordByColumn(
        "users",
        "email",
        userData.user.email,
        "role",
      );

      if (!isMounted || profileError || !profile) {
        return;
      }

      setRequesterRole(profile.role || "");
    }

    loadRequesterRole();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (endTime > startTime) {
      return;
    }

    const nextEndTime = END_TIME_OPTIONS.find((time) => time > startTime);
    if (nextEndTime) {
      setEndTime(nextEndTime);
    }
  }, [endTime, startTime]);

  useEffect(() => {
    if (!currentDate || Number.isNaN(currentDate.getTime())) {
      setCurrentDate(getMinBookingDate());
      return;
    }

    if (!isBookingDateAllowed(currentDate)) {
      if (isWeekendDate(currentDate)) {
        setLocalDateWarning(
          "Weekends are not allowed. Date changed to the next valid weekday.",
        );
      } else if (currentDate < getMinBookingDate()) {
        setLocalDateWarning(
          "Bookings must be at least 7 days in advance. Date adjusted automatically.",
        );
      }

      setCurrentDate(getAdjacentAllowedBookingDate(currentDate, 1));
      return;
    }

    setLocalDateWarning("");
  }, [currentDate]);

  // ===== get equipment =====
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchEquipment() {
      const { data } = await supabase
        .from("equipment")
        .select("*")
        .eq("id", id)
        .single();

      setEquipment(data);
    }

    fetchEquipment();
  }, [id]);

  // ===== get booking =====
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchBookings() {
      const { data } = await supabase
        .from("equipment_bookings")
        .select("*")
        .eq("equipment_id", id)
        .eq("booking_date", formatDateForDB(currentDate));

      const timetableEvents = getEquipmentTimetableEvents(
        id,
        formatDateForDB(currentDate),
      ).map((event) => ({
        id: `class-${event.id}`,
        equipment_id: id,
        status: "class",
        start_time: `${event.startTime}:00`,
        end_time: `${event.endTime}:00`,
        title: event.title,
      }));

      setBookings([...(data || []), ...timetableEvents]);
    }

    fetchBookings();
  }, [id, currentDate]);

  if (!equipment) {
    return (
      <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
        <section className="rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
          <p className="rounded-lg border border-border-light bg-white px-3 py-4 text-sm text-text-muted">
            Loading equipment...
          </p>
        </section>
      </main>
    );
  }

  //status
  const getStatus = (time) => {
    const slotStart = toMinutes(time);
    const slotEnd = toMinutes(addHour(time));

    for (let b of bookings) {
      const start = toMinutes(normalizeTime(b.start_time));
      const end = toMinutes(normalizeTime(b.end_time));

      if (
        ["pending", "approved", "class"].includes(b.status) &&
        slotStart < end &&
        slotEnd > start
      ) {
        return b.status;
      }
    }

    return "available";
  };

  //duration / total
  const durationMinutes = toMinutes(endTime) - toMinutes(startTime);
  const duration = Math.max(0, durationMinutes / 60);
  const total = duration * equipment.price_per_hour;

  //  check availability
  const isTimeAvailable = () => {
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);

    return !bookings.some((b) => {
      const bStart = toMinutes(normalizeTime(b.start_time));
      const bEnd = toMinutes(normalizeTime(b.end_time));

      return (
        ["pending", "approved", "class"].includes(b.status) &&
        start < bEnd &&
        end > bStart
      );
    });
  };

  const available = isTimeAvailable();
  const selectedDateString = formatDateForDB(currentDate);
  const timetableConflict = findEquipmentTimetableConflict({
    equipmentId: id,
    date: selectedDateString,
    startTime,
    endTime,
  });
  const isTimeValid = startTime < endTime;
  const isDateValid = isBookingDateStringAllowed(selectedDateString);
  const isOfficeRangeValid = isOfficeTimeRange(startTime, endTime);
  const validationStatus = !isTimeValid
    ? "invalid"
    : isEquipmentUnderMaintenance
      ? "maintenance"
    : !isDateValid
    ? "date_invalid"
    : !isOfficeRangeValid
      ? "office_hours_invalid"
      : timetableConflict
        ? "class"
        : available
          ? "available"
          : "conflict";
  const isPicRequester = requesterRole === "pic";
  const votValidation = validateMockVotFunding({
    projectGrantVotNo,
    expenseVot,
  });
  const hasVotInput = Boolean(projectGrantVotNo.trim() || expenseVot.trim());
  const paymentError =
    hasVotInput && !votValidation.ok ? votValidation.error : "";
  const hasCompleteBookingFields = Boolean(
    selectedDateString &&
      startTime &&
      endTime &&
      usage.trim() &&
      projectGrantVotNo.trim() &&
      expenseVot.trim() &&
      (isPicRequester || token.trim()),
  );
  const canSubmit =
    validationStatus === "available" &&
    hasCompleteBookingFields &&
    votValidation.ok &&
    !isSubmitting;

  //handle booking
  const handleSubmitBooking = async (e) => {
    e?.preventDefault();

    if (isSubmitting) return;

    setErrorMessage("");
    setSuccessMessage("");

    const formattedToken = token.trim().toUpperCase();

    try {
      setIsSubmitting(true);

      if (validationStatus !== "available") {
        setErrorMessage(
          validationStatus === "date_invalid"
            ? "Bookings must be at least 7 days in advance on weekdays."
            : validationStatus === "office_hours_invalid"
              ? "Bookings must be within office hours (08:00 to 18:00)."
              : validationStatus === "class"
                ? "This slot clashes with the teaching timetable."
                : validationStatus === "maintenance"
                  ? "This equipment is under maintenance and cannot be booked."
                : validationStatus === "invalid"
                  ? "End time must be after start time."
                : "Time slot not available. Please select another time.",
        );
        return;
      }

      if (!usage.trim()) {
        setErrorMessage("Please describe your usage purpose.");
        return;
      }

      if (!votValidation.ok) {
        setErrorMessage(votValidation.error);
        return;
      }

      if (!isPicRequester && !formattedToken) {
        setErrorMessage("Please enter your PIC token.");
        return;
      }

      const { data: sessionData } = await getCurrentSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setErrorMessage("Please log in before booking equipment.");
        return;
      }

      const bookingResponse = await fetch("/api/equipment-bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          equipmentId: id,
          bookingDate: selectedDateString,
          startTime: `${startTime}:00`,
          endTime: `${endTime}:00`,
          picCode: isPicRequester ? "" : formattedToken,
          bookingReason: usage.trim(),
          projectGrantVotNo: projectGrantVotNo.trim().toUpperCase(),
          expenseVot: expenseVot.trim(),
          grantNumber: projectGrantVotNo.trim().toUpperCase(),
          votNumber: expenseVot.trim(),
        }),
      });

      const bookingData = await bookingResponse.json();

      if (!bookingResponse.ok) {
        setErrorMessage(
          bookingData?.error || "Booking failed. Please try again.",
        );
        return;
      }

      if (!bookingData?.booking) {
        setErrorMessage("Booking submitted, but booking details are missing.");
        return;
      }

      setSuccessMessage(
        bookingData.message || "Booking submitted. Waiting for approval.",
      );
      setBookings((currentBookings) => [
        ...currentBookings,
        bookingData.booking,
      ]);
      setToken("");
      setUsage("");
      setProjectGrantVotNo("");
      setExpenseVot("");
    } catch (err) {
      console.error(err);
      setErrorMessage("Unexpected error while booking equipment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
      <section className="min-h-[calc(100vh-7rem)] rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            className="w-auto text-sm"
          >
            Back
          </Button>

          <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
            <div className="text-center">
              <h1 className="text-3xl font-semibold text-primary">
                {equipment.name}
              </h1>
              <p className="mt-2 text-sm text-text-muted">ID: {equipment.id}</p>
              <p className="mt-3 text-sm font-semibold text-primary">
                {formatRmFromUsd(equipment.price_per_hour || 0)}/hr
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4 text-sm text-text-muted md:p-5">
            <p className="font-semibold text-primary">Before you submit</p>
            <p className="mt-2">
              Select an available time, describe the usage purpose, then{" "}
              {isPicRequester
                ? "submit the booking request for approval."
                : "enter the 6-character PIC token assigned to your account."}{" "}
              The request will appear as pending until it is approved.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Earliest booking date is 7 days from today.</li>
              <li>Weekends are not available for booking.</li>
              <li>Office hours only: 08:00 to 18:00.</li>
              <li>Class timetable slots are blocked automatically.</li>
            </ul>

            {rescheduleFromId ? (
              <p className="mt-3 rounded-lg border border-warning/20 bg-white px-3 py-2 text-warning">
                You are creating a new booking request from approved booking {" "}
                <span className="font-semibold">{rescheduleFromId}</span>. Your
                original booking remains active.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
              01 Availability
            </p>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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

                <h2 className="whitespace-nowrap text-xl font-semibold text-text-main">
                  {formatDate(currentDate)}
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setCurrentDate(
                      parseDateInput(getDefaultBookingDateString()) ||
                        getMinBookingDate(),
                    )
                  }
                  className="w-auto text-sm"
                >
                  Earliest
                </Button>

                <Input
                  type="date"
                  value={selectedDateString}
                  onChange={(event) =>
                    event.target.value &&
                    setCurrentDate(
                      parseDateInput(event.target.value) || currentDate,
                    )
                  }
                  min={getMinBookingDateString()}
                  onClick={(event) => event.target.showPicker?.()}
                  className="cursor-pointer sm:w-44"
                />
              </div>
            </div>

            {localDateWarning ? (
              <p className="mb-3 rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
                {localDateWarning}
              </p>
            ) : null}

            <div className="overflow-x-auto pb-4">
              <p className="mb-3 text-xs text-text-muted">
                Tip: scroll sideways to view all time slots.
              </p>
              <div
                style={{
                  minWidth: `calc(160px + ${(times.length - 1) * 120}px)`,
                }}
              >
                <div
                  className="mb-4 grid gap-4 text-sm text-text-muted"
                  style={{
                    gridTemplateColumns: `160px repeat(${times.length - 1}, 120px)`,
                  }}
                >
                  <div />

                  {times.map((time, index) => {
                    if (index === times.length - 1) return null;

                    const hour = parseInt(time.split(":")[0]);
                    const next = String(hour + 1).padStart(2, "0");

                    return (
                      <div key={time} className="text-center font-medium">
                        {hour}:00 - {next}:00
                      </div>
                    );
                  })}
                </div>

                <div
                  className="grid items-center gap-4"
                  style={{
                    gridTemplateColumns: `160px repeat(${times.length - 1}, 120px)`,
                  }}
                >
                  <div>
                    <p className="font-semibold text-text-main">
                      {equipment.name}
                    </p>
                    <p className="text-sm text-text-muted">
                      {equipment.location || "-"}
                    </p>
                  </div>

                  {times.map((time, index) => {
                    if (index === times.length - 1) return null;

                    const status = getStatus(time);
                    const displayStatus = isEquipmentUnderMaintenance
                      ? "maintenance"
                      : status;

                    return (
                      <div
                        key={time}
                        className={`flex h-24 items-center justify-center rounded-xl border text-sm font-semibold ${
                          displayStatus === "maintenance"
                            ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                            : displayStatus === "approved"
                            ? "border-primary/20 bg-white text-primary"
                            : displayStatus === "pending"
                              ? "border-purple-200 bg-purple-50 text-purple-700"
                              : displayStatus === "class"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                               : "border-green-200 bg-green-50 text-green-700"
                        }`}
                      >
                        {displayStatus === "maintenance" && "MAINTENANCE"}
                        {displayStatus === "approved" && "RESERVED"}
                        {displayStatus === "pending" && "PENDING"}
                        {displayStatus === "class" && "CLASS"}
                        {displayStatus === "available" && "AVAILABLE"}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
              02 Date and Time Selection
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted">
                  DATE
                </p>
                <div className="rounded-xl border border-border-light bg-background-main px-3 py-3 text-text-main">
                  {formatDate(currentDate)}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted">
                  DURATION
                </p>
                <div className="rounded-xl border border-border-light bg-background-main px-3 py-3 text-text-main">
                  {duration}h
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted">
                  START TIME
                </p>
                <select
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-text-main outline-none transition-colors focus:border-primary"
                >
                  {START_TIME_OPTIONS.map((time) => (
                    <option key={time}>{time}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted">
                  END TIME
                </p>
                <select
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-text-main outline-none transition-colors focus:border-primary"
                >
                  {END_TIME_OPTIONS
                    .filter((time) => time > startTime)
                    .map((time) => (
                      <option key={time}>{time}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold tracking-wide text-text-muted">
                SUGGESTED SLOTS
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["09:00", "11:00"],
                  ["11:00", "13:00"],
                  ["14:00", "16:00"],
                  ["15:00", "17:00"],
                ].map(([suggestedStart, suggestedEnd]) => {
                  const suggestedDuration =
                    (toMinutes(suggestedEnd) - toMinutes(suggestedStart)) / 60;

                  const hasBookingConflict = bookings.some((booking) => {
                    const bookingStart = toMinutes(normalizeTime(booking.start_time));
                    const bookingEnd = toMinutes(normalizeTime(booking.end_time));
                    return (
                      ["pending", "approved", "class"].includes(booking.status) &&
                      toMinutes(suggestedStart) < bookingEnd &&
                      toMinutes(suggestedEnd) > bookingStart
                    );
                  });
                  const slotAvailable =
                    !hasBookingConflict && !isEquipmentUnderMaintenance;

                  return (
                    <button
                      type="button"
                      key={`${suggestedStart}-${suggestedEnd}`}
                      disabled={!slotAvailable}
                      onClick={() => {
                        if (!slotAvailable) return;
                        setStartTime(suggestedStart);
                        setEndTime(suggestedEnd);
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        slotAvailable
                          ? "border-border-light bg-background-main hover:border-primary"
                          : "cursor-not-allowed border-warning/20 bg-white opacity-70"
                      }`}
                    >
                      <p className="text-lg font-semibold text-text-main">
                        {suggestedStart} - {suggestedEnd}
                      </p>
                      <p className="mt-1 text-sm text-text-muted">
                        {suggestedDuration}h
                      </p>
                      <p
                        className={`mt-3 text-sm font-semibold ${
                          slotAvailable ? "text-primary" : "text-warning"
                        }`}
                      >
                        {slotAvailable
                          ? "QUICK SELECT"
                          : isEquipmentUnderMaintenance
                            ? "MAINTENANCE"
                            : "NOT AVAILABLE"}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div
                className={`mt-6 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  validationStatus === "available"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : validationStatus === "class"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-warning/20 bg-white text-warning"
                }`}
              >
                {validationStatus === "available"
                  ? "Slot is available"
                  : validationStatus === "maintenance"
                    ? "This equipment is under maintenance"
                  : validationStatus === "class"
                    ? "Slot blocked by class timetable"
                    : validationStatus === "invalid"
                      ? "End time must be after start time"
                    : validationStatus === "date_invalid"
                      ? "Date must be on a weekday and at least 7 days ahead"
                      : validationStatus === "office_hours_invalid"
                        ? "Time must be within office hours (08:00 to 18:00)"
                        : "Time slot not available"}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
              03 Usage Context
            </p>
            <textarea
              placeholder="Briefly describe research objective..."
              className="min-h-28 w-full rounded-xl border border-border-light bg-white p-3 text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-primary"
              value={usage}
              onChange={(event) => setUsage(event.target.value)}
            />
          </div>

          <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
              04 Billing
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Grant Number
                </p>
                <Input
                  placeholder="Q.J130000.3851.19J91"
                  value={projectGrantVotNo}
                  onChange={(event) => {
                    const nextValue = event.target.value.toUpperCase();
                    setProjectGrantVotNo(nextValue);
                    if (!nextValue.trim()) {
                      setExpenseVot("");
                    }
                  }}
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  VOT Number
                </p>
                <select
                  value={expenseVot}
                  onChange={(event) => setExpenseVot(event.target.value)}
                  disabled={!projectGrantVotNo.trim()}
                  className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-text-main outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-background-main disabled:text-text-muted"
                >
                  <option value="">Select VOT number</option>
                  {MOCK_VOT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {projectGrantVotNo.trim() && expenseVot.trim() ? (
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Total Price
                </p>
                <Input value={formatRmFromUsd(total)} readOnly />
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => applySampleVot(MOCK_VOT_ACCOUNTS.sufficient)}
                className="w-auto text-sm"
              >
                Use sample with sufficient funds
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => applySampleVot(MOCK_VOT_ACCOUNTS.insufficient)}
                className="w-auto text-sm"
              >
                Use sample with insufficient funds
              </Button>
            </div>

            {paymentError ? (
              <p className="mt-3 rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
                {paymentError}
              </p>
            ) : (
              <p className="mt-3 text-sm text-text-muted">
                Payment will be processed once the request has been approved.
              </p>
            )}
          </div>

          {!isPicRequester ? (
            <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
              <p className="mb-2 text-xs font-semibold tracking-wide text-text-muted">
                05 PIC TOKEN
              </p>
              <p className="mb-3 text-sm text-text-muted">
                Ask the responsible PIC for a 6-character token. Tokens are tied
                to your account and can be reused until they expire.
              </p>
              <Input
                placeholder="Enter your 6-character token"
                value={token}
                maxLength={6}
                onChange={(event) => setToken(event.target.value.toUpperCase())}
              />

              {errorMessage ? (
                <p className="mt-3 rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
                  {errorMessage}
                </p>
              ) : null}

              {successMessage ? (
                <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {successMessage}
                </p>
              ) : null}
            </div>
          ) : (
            <>
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
            </>
          )}

          <div className="flex flex-col gap-4 rounded-xl border border-border-light bg-white p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div>
              <p className="text-xs font-semibold tracking-wide text-text-muted">
                06 EST. TOTAL
              </p>
              <p className="text-2xl font-semibold text-primary">
                {formatRmFromUsd(total)}
              </p>
            </div>

            <Button
              onClick={handleSubmitBooking}
              disabled={!canSubmit}
              className="md:w-auto"
            >
                {isSubmitting
                  ? "Submitting..."
                  : successMessage
                    ? "Booking Successful"
                  : validationStatus === "available"
                    ? "Book Now"
                    : validationStatus === "maintenance"
                      ? "Under Maintenance"
                      : "Cannot Book - Conflict"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
