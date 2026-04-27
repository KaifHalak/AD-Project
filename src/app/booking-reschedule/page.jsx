"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";

const VALID_START_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const VALID_END_TIMES   = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const AVAILABILITY = [
  { start: "08:00", end: "09:00", status: "booked",    bookedBy: "Dr. Smith" },
  { start: "09:00", end: "11:00", status: "available" },
  { start: "11:00", end: "13:00", status: "available" },
  { start: "13:00", end: "14:00", status: "pending" },
  { start: "14:00", end: "17:00", status: "available" },
  { start: "17:00", end: "18:00", status: "booked",    bookedBy: "Lab Team" },
];

const SUGGESTED_SLOTS = [
  { start: "09:00", end: "11:00", duration: "2h" },
  { start: "11:00", end: "13:00", duration: "2h" },
  { start: "14:00", end: "16:00", duration: "2h" },
  { start: "15:00", end: "17:00", duration: "2h" },
];

const SCHEDULE_SLOTS = [
  { status: "booked",    user: "Dr. Smith" },
  { status: "available" },
  { status: "available" },
  { status: "available" },
  { status: "booked",    user: "Lab Team" },
  { status: "pending" },
  { status: "available" },
  { status: "available" },
  { status: "available" },
  { status: "booked",    user: "Research" },
];

function formatDateDisplay(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function addDays(dateString, days) {
  const d = new Date(dateString + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function calcDuration(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const total = (eh * 60 + em) - (sh * 60 + sm);
  if (total <= 0) return "–";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function BookingReschedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingId   = searchParams.get("id")   || "";
  const bookingType = searchParams.get("type")  || "lab";
  const bookingName = searchParams.get("name")  || "";

  const [isLoading, setIsLoading]       = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessToken, setAccessToken]   = useState("");
  const [booking, setBooking]           = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const tomorrow = addDays(new Date().toISOString().split("T")[0], 1);
  const [newDate,    setNewDate]    = useState(tomorrow);
  const [startTime,  setStartTime]  = useState("09:00");
  const [endTime,    setEndTime]    = useState("11:00");
  const [reason,     setReason]     = useState("");
  const [validation, setValidation] = useState(null);
  const [valMessage, setValMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const { data: sessionData } = await getCurrentSession();
        if (!isMounted) return;
        if (!sessionData?.session) { router.push("/"); return; }
        const token = sessionData.session.access_token;
        setAccessToken(token);

        if (!bookingId) { setErrorMessage("No booking ID provided."); setIsLoading(false); return; }

        const res = await fetch(`/api/bookings/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setBooking(data.booking);
        }
      } catch {
        if (isMounted) setErrorMessage("Could not load booking details.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => { isMounted = false; };
  }, [router, bookingId]);

  useEffect(() => {
    if (startTime >= endTime) {
      setValidation("invalid");
      setValMessage("End time must be after start time");
      return;
    }
    const conflict = AVAILABILITY.find((slot) => {
      const overlap = !(endTime <= slot.start || startTime >= slot.end);
      return overlap && slot.status !== "available";
    });
    if (conflict) {
      if (conflict.status === "booked") {
        setValidation("conflict");
        setValMessage(`Conflicts with an existing booking${conflict.bookedBy ? ` by ${conflict.bookedBy}` : ""}`);
      } else {
        setValidation("pending");
        setValMessage("This slot is pending approval by another user");
      }
      return;
    }
    setValidation("valid");
    setValMessage("Slot is available");
  }, [startTime, endTime, newDate]);

  async function handleSubmit() {
    if (validation !== "valid" || !bookingId) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          booking_date: newDate,
          start_time: startTime + ":00",
          end_time:   endTime   + ":00",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMessage(data.error || "Could not reschedule."); return; }
      setSuccessMessage("Booking rescheduled successfully!");
      setTimeout(() => router.push("/booking-records"), 1500);
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <Loader text="Loading booking details..." />;

  const originalDate = booking?.booking_date
    ? formatDateDisplay(booking.booking_date)
    : "–";
  const originalTime = booking
    ? `${(booking.start_time || "").slice(0, 5)} – ${(booking.end_time || "").slice(0, 5)}`
    : "–";
  const canSubmit = validation === "valid";
  const displayName = bookingName || booking?.resource_name || "";

  return (
    <main className="min-h-screen bg-[#F4F0E6] px-6 py-12 md:px-12">
      {/* Header */}
      <div className="mb-8">
        <div className="text-[10px] tracking-[0.15em] uppercase text-[#6b6b6b] mb-3">
          {bookingType === "lab" ? "Laboratory Booking" : "Equipment Booking"}
        </div>
        <div className="flex items-center gap-3 mb-2">
          <Link href="/booking-records" className="text-[#6b6b6b] hover:text-[#1a1a1a]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-[48px] leading-[1.1] font-bold text-[#1a1a1a]">
            Reschedule Booking
          </h1>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 font-semibold">
          {successMessage}
        </div>
      )}

      <div className="max-w-5xl space-y-12">

        {/* 01 Resource */}
        <section>
          <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-4">
            01 {bookingType === "lab" ? "Laboratory" : "Equipment"}
          </h2>
          <div className="bg-[#FAF8F4] rounded-2xl p-6 border border-[rgba(0,0,0,0.04)]">
            <p className="text-[20px] font-bold text-[#1a1a1a]">{displayName}</p>
          </div>
        </section>

        {/* 02 Original Booking */}
        <section>
          <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">
            02 Original Booking Details
          </h2>
          <div className="bg-[#FAF8F4] rounded-2xl p-6 border border-[rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                  Original Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                  <input
                    type="text"
                    value={originalDate}
                    readOnly
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F8F6F2] border border-[rgba(0,0,0,0.06)] text-[14px] text-[#6b6b6b] cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                  Original Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                  <input
                    type="text"
                    value={originalTime}
                    readOnly
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F8F6F2] border border-[rgba(0,0,0,0.06)] text-[14px] text-[#6b6b6b] cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 03 Availability Preview */}
        <section>
          <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">
            03 Availability Preview
          </h2>
          <div className="bg-[#FAF8F4] rounded-2xl p-8 border border-[rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setNewDate(addDays(newDate, -1))}
                  className="w-10 h-10 rounded-xl bg-white hover:bg-[#F4F0E6] border border-[rgba(0,0,0,0.06)] flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-[#1a1a1a]" />
                </button>
                <h3 className="text-[22px] font-bold text-[#1a1a1a]">
                  {formatDateDisplay(newDate)}
                </h3>
                <button
                  onClick={() => setNewDate(addDays(newDate, 1))}
                  className="w-10 h-10 rounded-xl bg-white hover:bg-[#F4F0E6] border border-[rgba(0,0,0,0.06)] flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-[#1a1a1a]" />
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setNewDate(new Date().toISOString().split("T")[0])}
                  className="px-5 py-2.5 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-[#F4F0E6] transition-colors"
                >
                  TODAY
                </button>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => e.target.value && setNewDate(e.target.value)}
                  className="px-4 py-2 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="grid grid-cols-[180px_repeat(10,110px)] gap-2 mb-3">
                  <div className="text-[11px] tracking-[0.1em] uppercase text-[#6b6b6b] font-semibold">
                    {bookingType === "lab" ? "Laboratory" : "Equipment"}
                  </div>
                  {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"].map((t) => (
                    <div key={t} className="text-center text-[13px] font-semibold text-[#1a1a1a]">{t}</div>
                  ))}
                </div>
                <div className="grid grid-cols-[180px_repeat(10,110px)] gap-2 items-center">
                  <div>
                    <div className="font-semibold text-[15px] text-[#1a1a1a]">{displayName}</div>
                    <div className="text-[12px] text-[#6b6b6b]">Building A, Room 204</div>
                  </div>
                  {SCHEDULE_SLOTS.map((slot, i) => {
                    const t = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"][i];
                    if (slot.status === "available") {
                      return (
                        <button
                          key={i}
                          onClick={() => { setStartTime(t); setEndTime(VALID_END_TIMES[VALID_START_TIMES.indexOf(t)] || "18:00"); }}
                          className="h-20 rounded-2xl bg-[#A8E6CF] hover:bg-[#96DFBE] hover:shadow-lg hover:scale-105 transition-all duration-200 border-2 border-transparent hover:border-[#84D4AC]"
                        />
                      );
                    }
                    return (
                      <div
                        key={i}
                        className={`h-20 rounded-2xl flex flex-col items-center justify-center text-center px-1 ${
                          slot.status === "booked" ? "bg-[#E6A8C4]" : "bg-[#D4A8E6]"
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#1a1a1a]">
                          {slot.status}
                        </span>
                        {slot.user && (
                          <span className="text-[9px] text-[#6b6b6b] mt-0.5 line-clamp-1">{slot.user}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 04 New Date & Time */}
        <section>
          <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">
            04 New Date &amp; Time Selection
          </h2>
          <div className="bg-[#FAF8F4] rounded-2xl p-8 border border-[rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2">
              <div>
                <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                  New Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => e.target.value && setNewDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                  Duration
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                  <input
                    type="text"
                    value={calcDuration(startTime, endTime)}
                    readOnly
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F8F6F2] border border-[rgba(0,0,0,0.06)] text-[14px] text-[#6b6b6b]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2">
              <div>
                <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                  Start Time
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                >
                  {VALID_START_TIMES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                  End Time
                </label>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                >
                  {VALID_END_TIMES.filter((t) => t > startTime).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Suggested slots */}
            <div className="mb-6">
              <h3 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-3">
                Suggested Slots
              </h3>
              <div className="flex gap-3 flex-wrap">
                {SUGGESTED_SLOTS.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => { setStartTime(slot.start); setEndTime(slot.end); }}
                    className="flex flex-col items-start p-4 rounded-xl bg-white hover:bg-[#F4E8F0] hover:border-[#B0005A] border border-[rgba(0,0,0,0.06)] transition-all min-w-[160px]"
                  >
                    <div className="text-[14px] font-semibold text-[#1a1a1a] mb-1">{slot.start} – {slot.end}</div>
                    <div className="text-[11px] text-[#6b6b6b] mb-2">{slot.duration}</div>
                    <div className="text-[#B0005A] text-[10px] font-semibold tracking-wide">QUICK SELECT</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Validation banner */}
            {validation && (
              <div className={`px-4 py-3 rounded-xl flex items-center gap-3 ${
                validation === "valid"   ? "bg-[#A8E6CF]" :
                validation === "pending" ? "bg-[#D4A8E6]" : "bg-[#FFF0F5]"
              }`}>
                {validation === "valid"
                  ? <CheckCircle className="w-5 h-5 text-[#1a1a1a]" />
                  : <AlertCircle className="w-5 h-5 text-[#1a1a1a]" />}
                <span className="text-[13px] font-semibold text-[#1a1a1a]">{valMessage}</span>
              </div>
            )}
          </div>
        </section>

        {/* 05 Reason */}
        <section>
          <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">
            05 Reason for Rescheduling
          </h2>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly explain the reason for rescheduling..."
            rows={6}
            className="w-full px-6 py-4 rounded-2xl bg-[#FAF8F4] border border-[rgba(0,0,0,0.06)] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20 resize-none"
          />
        </section>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-4 pt-8 mt-12 border-t border-[rgba(0,0,0,0.06)] max-w-5xl">
        <Link
          href="/booking-records"
          className="px-8 py-3 rounded-xl text-[#6b6b6b] hover:bg-[#F4F0E6] transition-colors font-medium"
        >
          Cancel
        </Link>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className={`px-12 py-4 rounded-full font-semibold transition-colors shadow-lg text-[16px] ${
            canSubmit && !isSubmitting
              ? "bg-[#B0005A] text-white hover:bg-[#900048]"
              : "bg-[#E8E4DA] text-[#6b6b6b] cursor-not-allowed"
          }`}
        >
          {isSubmitting
            ? "Saving..."
            : canSubmit
              ? "Confirm Reschedule"
              : "Cannot Reschedule – Conflict"}
        </button>
      </div>
    </main>
  );
}
