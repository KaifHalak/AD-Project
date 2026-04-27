"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentSession } from "@/lib/supabase/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function EquipmentBookingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [equipment, setEquipment] = useState(null);
  const [bookings, setBookings] = useState([]);

  const [currentDate, setCurrentDate] = useState(new Date());

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const toHour = (t) => parseInt(t.split(":")[0]);

  const [usage, setUsage] = useState("");
  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const times = [
    "08:00","09:00","10:00","11:00","12:00",
    "13:00","14:00","15:00","16:00","17:00","18:00"
  ];

  // ===== 日期处理 =====
  const formatDateForDB = (d) => d.toISOString().split("T")[0];

  const formatDate = (d) =>
    d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

  const changeDate = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + offset);
    setCurrentDate(newDate);
  };

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

      setBookings(data || []);
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
    const hour = parseInt(time);

    for (let b of bookings) {
      const start = parseInt(b.start_time);
      const end = parseInt(b.end_time);

      if (["pending", "approved"].includes(b.status) && hour >= start && hour < end) {
        return b.status;
      }
    }

    return "available";
  };

  //duration / total
  const duration = parseInt(endTime) - parseInt(startTime);
  const total = duration * equipment.price_per_hour;

  //  check availability
  const isTimeAvailable = () => {
    const start = toHour(startTime);
    const end = toHour(endTime);

    return !bookings.some((b) => {
      const bStart = toHour(b.start_time);
      const bEnd = toHour(b.end_time);

      return ["pending", "approved"].includes(b.status) && start < bEnd && end > bStart;
    });
  };

  const available = isTimeAvailable();

  //handle booking
  const handleSubmitBooking = async (e) => {
    e?.preventDefault();

    if (isSubmitting) return;

    setErrorMessage("");
    setSuccessMessage("");

    const formattedToken = token.trim().toUpperCase();

    try {
      setIsSubmitting(true);

      if (!available) {
        setErrorMessage("Time slot not available. Please select another time.");
        return;
      }

      if (!formattedToken) {
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
          bookingDate: formatDateForDB(currentDate),
          startTime: `${startTime}:00`,
          endTime: `${endTime}:00`,
          picCode: formattedToken,
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
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4 text-sm text-text-muted md:p-5">
            <p className="font-semibold text-primary">Before you submit</p>
            <p className="mt-2">
              Select an available time, describe the usage purpose, then enter
              the 6-character PIC token assigned to your account. The request
              will appear as pending until it is approved.
            </p>
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
                  onClick={() => setCurrentDate(new Date())}
                  className="w-auto text-sm"
                >
                  Today
                </Button>

                <Input
                  type="date"
                  value={currentDate.toISOString().split("T")[0]}
                  onChange={(event) =>
                    setCurrentDate(new Date(event.target.value))
                  }
                  onClick={(event) => event.target.showPicker?.()}
                  className="cursor-pointer sm:w-44"
                />
              </div>
            </div>

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

                    return (
                      <div
                        key={time}
                        className={`flex h-24 items-center justify-center rounded-xl border text-sm font-semibold ${
                          status === "approved"
                            ? "border-primary/20 bg-white text-primary"
                            : status === "pending"
                              ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                              : "border-green-200 bg-green-50 text-green-700"
                        }`}
                      >
                        {status === "approved" && "RESERVED"}
                        {status === "pending" && "PENDING"}
                        {status === "available" && "AVAILABLE"}
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
                  {times.map((time) => (
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
                  {times
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
                    parseInt(suggestedEnd) - parseInt(suggestedStart);

                  const slotAvailable = !bookings.some((booking) => {
                    const bookingStart = parseInt(booking.start_time);
                    const bookingEnd = parseInt(booking.end_time);
                    return (
                      ["pending", "approved"].includes(booking.status) &&
                      parseInt(suggestedStart) < bookingEnd &&
                      parseInt(suggestedEnd) > bookingStart
                    );
                  });

                  return (
                    <button
                      type="button"
                      key={`${suggestedStart}-${suggestedEnd}`}
                      onClick={() => {
                        setStartTime(suggestedStart);
                        setEndTime(suggestedEnd);
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors hover:border-primary ${
                        slotAvailable
                          ? "border-border-light bg-background-main"
                          : "border-warning/20 bg-white"
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
                        {slotAvailable ? "QUICK SELECT" : "NOT AVAILABLE"}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div
                className={`mt-6 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  available
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-warning/20 bg-white text-warning"
                }`}
              >
                {available ? "Slot is available" : "Time slot not available"}
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
            <p className="mb-2 text-xs font-semibold tracking-wide text-text-muted">
              04 PIC TOKEN
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

          <div className="flex flex-col gap-4 rounded-xl border border-border-light bg-white p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div>
              <p className="text-xs font-semibold tracking-wide text-text-muted">
                05 EST. TOTAL
              </p>
              <p className="text-2xl font-semibold text-primary">${total}.00</p>
            </div>

            <Button
              onClick={handleSubmitBooking}
              disabled={isSubmitting}
              className="md:w-auto"
            >
              {isSubmitting ? "Submitting..." : "Book Now"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
