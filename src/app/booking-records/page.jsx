"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  ChevronDown,
  Check,
  Filter,
  X,
  FileText,
} from "lucide-react";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeString) {
  if (!timeString) return "";
  return timeString.slice(0, 5);
}

export default function BookingRecordsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const [selectedFilter, setSelectedFilter] = useState("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const fetchBookings = useCallback(
    async (token, filter) => {
      try {
        const params = filter && filter !== "all" ? `?type=${filter}` : "";
        const response = await fetch(`/api/bookings${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          setErrorMessage(data.error || "Could not load bookings.");
          return;
        }
        setBookings(data.bookings || []);
      } catch {
        setErrorMessage("Something went wrong while loading bookings.");
      }
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    async function init() {
      setIsLoading(true);
      try {
        const { data: sessionData } = await getCurrentSession();
        if (!isMounted) return;
        if (!sessionData?.session) {
          router.push("/");
          return;
        }
        const token = sessionData.session.access_token;
        setAccessToken(token);
        await fetchBookings(token, "all");
      } catch {
        if (isMounted) setErrorMessage("Something went wrong. Please try again.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    init();
    return () => { isMounted = false; };
  }, [router, fetchBookings]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target)
      ) {
        setIsFilterDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleFilter(filterId) {
    setSelectedFilter(filterId);
    setIsFilterDropdownOpen(false);
    if (accessToken) {
      fetchBookings(accessToken, filterId);
    }
  }

  function getFilterLabel() {
    if (selectedFilter === "lab") return "Lab Bookings";
    if (selectedFilter === "equipment") return "Equipment Bookings";
    return "All Bookings";
  }

  function handleCancelClick(booking) {
    setBookingToCancel(booking);
    setCancelError("");
    setCancelModalOpen(true);
  }

  async function handleConfirmCancel() {
    if (!bookingToCancel) return;
    setIsCancelling(true);
    setCancelError("");
    try {
      const response = await fetch(`/api/bookings/${bookingToCancel.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setCancelError(data.error || "Could not cancel booking.");
        return;
      }
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingToCancel.id ? { ...b, status: "cancelled" } : b,
        ),
      );
      setCancelModalOpen(false);
      setBookingToCancel(null);
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  function handleKeepBooking() {
    setCancelModalOpen(false);
    setBookingToCancel(null);
    setCancelError("");
  }

  function getStatusStyles(status) {
    switch (status) {
      case "approved":
        return "bg-[#A8E6CF] text-[#1a1a1a]";
      case "pending":
        return "bg-[#D4A8E6] text-[#1a1a1a]";
      case "cancelled":
        return "bg-[#E6C8B4] text-[#1a1a1a]";
      case "rejected":
        return "bg-[#E6A8A8] text-[#1a1a1a]";
      default:
        return "bg-[#E8E4DA] text-[#6b6b6b]";
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case "approved":
        return "Approved";
      case "pending":
        return "Pending Approval";
      case "cancelled":
        return "Cancelled";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  }

  if (isLoading) {
    return <Loader text="Loading booking records..." />;
  }

  const activeCancellableStatuses = ["pending", "approved"];

  return (
    <main className="min-h-screen bg-[#F4F0E6] px-6 py-12 md:px-12">
      {/* Header */}
      <div className="mb-8">
        <div className="text-[10px] tracking-[0.15em] uppercase text-[#6b6b6b] mb-3">
          Laboratory Booking
        </div>
        <h1 className="text-[48px] leading-[1.1] font-bold text-[#1a1a1a] mb-4">
          Booking Records
        </h1>
        <p className="text-[15px] text-[#6b6b6b] max-w-3xl leading-relaxed mb-6">
          Comprehensive log of your lab access and equipment usage requests.
          Filter by type to manage your bookings.
        </p>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold">
            Filter by Type:
          </span>
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
              className="px-5 py-2.5 rounded-xl bg-[#FAF8F4] border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-white transition-colors flex items-center gap-3 min-w-[200px] justify-between"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#6b6b6b]" />
                <span>{getFilterLabel()}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isFilterDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 w-[240px] bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-lg z-50 py-2">
                {[
                  { id: "all", label: "All Bookings" },
                  { id: "lab", label: "Lab Bookings" },
                  { id: "equipment", label: "Equipment Bookings" },
                ].map((option, idx) => (
                  <div key={option.id}>
                    {idx === 1 && (
                      <div className="border-t border-[rgba(0,0,0,0.06)] my-2" />
                    )}
                    <button
                      onClick={() => toggleFilter(option.id)}
                      className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#F4F0E6] transition-colors text-left"
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedFilter === option.id
                            ? "bg-[#B0005A] border-[#B0005A]"
                            : "border-[rgba(0,0,0,0.2)]"
                        }`}
                      >
                        {selectedFilter === option.id && (
                          <Check className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <span
                        className={`text-[14px] text-[#1a1a1a] ${option.id === "all" ? "font-semibold" : ""}`}
                      >
                        {option.label}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <span className="text-[13px] text-[#6b6b6b]">
            Showing {bookings.length} booking
            {bookings.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {/* Booking cards */}
      <div className="space-y-6">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="bg-[#FAF8F4] rounded-[28px] p-8 shadow-sm border border-[rgba(0,0,0,0.04)]"
          >
            <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
              {/* Image */}
              {booking.image_url ? (
                <img
                  src={booking.image_url}
                  alt={booking.resource_name}
                  className="w-[200px] h-[140px] object-cover rounded-2xl flex-shrink-0"
                />
              ) : (
                <div className="w-[200px] h-[140px] rounded-2xl bg-[#E8D4F0] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-10 h-10 text-[#B0005A]" />
                </div>
              )}

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <div className="inline-block px-3 py-1 rounded-full bg-[#F4E8F0] text-[#B0005A] text-[10px] font-semibold tracking-wide uppercase">
                    Your Request
                  </div>
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                      booking.type === "lab"
                        ? "bg-[#E8D4F0] text-[#8B5A9E]"
                        : "bg-[#D4E8F0] text-[#5A8B9E]"
                    }`}
                  >
                    {booking.type === "lab" ? "LAB" : "EQUIPMENT"}
                  </div>
                </div>

                <h3 className="text-[24px] font-bold text-[#1a1a1a] mb-1">
                  {booking.resource_name}
                </h3>
                {booking.resource_subtitle && (
                  <p className="text-[14px] text-[#6b6b6b] mb-6">
                    {booking.resource_subtitle}
                  </p>
                )}

                <div className="space-y-2 mt-4">
                  <div className="flex items-center gap-2 text-[14px] text-[#1a1a1a]">
                    <Calendar className="w-4 h-4 text-[#6b6b6b] flex-shrink-0" />
                    <span>{formatDate(booking.booking_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[14px] text-[#1a1a1a]">
                    <Clock className="w-4 h-4 text-[#6b6b6b] flex-shrink-0" />
                    <span>
                      {formatTime(booking.start_time)} –{" "}
                      {formatTime(booking.end_time)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status + Actions */}
              <div className="flex flex-col items-end gap-4 flex-shrink-0">
                <div
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase ${getStatusStyles(booking.status)}`}
                >
                  {getStatusLabel(booking.status)}
                </div>

                <div className="flex flex-col gap-2">
                  {booking.status === "approved" && (
                    <Link
                      href={`/booking-reschedule?id=${booking.id}&type=${booking.type}&name=${encodeURIComponent(booking.resource_name)}`}
                      className="px-6 py-2.5 rounded-xl bg-[#B0005A] text-white text-sm font-semibold hover:bg-[#900048] transition-colors text-center"
                    >
                      Reschedule Date
                    </Link>
                  )}
                  {activeCancellableStatuses.includes(booking.status) && (
                    <button
                      onClick={() => handleCancelClick(booking)}
                      className="px-6 py-2.5 rounded-xl bg-white border-2 border-[#D0547B] text-[#D0547B] text-sm font-semibold hover:bg-[#FFF0F5] transition-colors"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {bookings.length === 0 && !errorMessage && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#F4E8F0] flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-[#B0005A]" />
          </div>
          <p className="text-[18px] font-semibold text-[#1a1a1a] mb-2">
            No bookings found
          </p>
          <p className="text-[14px] text-[#6b6b6b]">
            {selectedFilter === "all"
              ? "You have not made any bookings yet."
              : `No ${selectedFilter} bookings found.`}
          </p>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {cancelModalOpen && bookingToCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={handleKeepBooking}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-[#F4F0E6] hover:bg-[#E8E4DA] flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-[#6b6b6b]" />
            </button>

            <div className="mb-6">
              <h2 className="text-[28px] font-bold text-[#1a1a1a] mb-4">
                {bookingToCancel.status === "approved"
                  ? "Cancel Booking?"
                  : "Cancel Request?"}
              </h2>
              <p className="text-[15px] text-[#6b6b6b] leading-relaxed">
                {bookingToCancel.status === "approved"
                  ? "This will release your reserved time slot and cannot be undone."
                  : "This request is still under review. Cancelling it will remove your request."}
              </p>
            </div>

            {cancelError && (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {cancelError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleKeepBooking}
                disabled={isCancelling}
                className="flex-1 px-6 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-[#F4F0E6] transition-colors disabled:opacity-60"
              >
                {bookingToCancel.status === "approved"
                  ? "Keep Booking"
                  : "Keep Request"}
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="flex-1 px-6 py-3 rounded-xl bg-[#D0547B] text-white text-sm font-semibold hover:bg-[#B8416A] transition-colors disabled:opacity-60"
              >
                {isCancelling
                  ? "Cancelling..."
                  : bookingToCancel.status === "approved"
                    ? "Cancel Booking"
                    : "Cancel Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
