"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentSession, getCurrentUser } from "@/lib/supabase/auth";
import { getRecordByColumn } from "@/lib/supabase/db";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";
import { formatRmFromUsd } from "@/lib/currency";
import {
  BOOKING_AGREEMENT_TEXT,
  downloadQuotationPdf,
} from "@/lib/quotationPdf";
import {
  END_TIME_OPTIONS,
  START_TIME_OPTIONS,
  getAdjacentAllowedBookingDate,
  formatDateInput,
  getDefaultBookingDateString,
  getMinBookingDate,
  getMinBookingDateString,
  isBookingDateAllowed,
  isBookingDateStringAllowed,
  isOfficeTimeRange,
  isWeekendDate,
  parseDateInput,
} from "@/lib/bookingConstraints";
import {
  findLabTimetableConflict,
  getLabTimetableEvents,
} from "@/lib/mockTimetable";

const START_TIMES = START_TIME_OPTIONS;

const END_TIMES = END_TIME_OPTIONS;
const MAX_RANGE_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SUGGESTED_SLOTS = [
  ["09:00", "11:00"],
  ["11:00", "13:00"],
  ["14:00", "16:00"],
  ["15:00", "17:00"],
];

function formatDateForDB(date) {
  return formatDateInput(date);
}

function formatDisplayDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function normalizeTime(time) {
  return (time || "").slice(0, 5);
}

function addHour(time) {
  const hour = Number(time.split(":")[0]) + 1;
  return `${String(hour).padStart(2, "0")}:00`;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDuration(startTime, endTime) {
  const durationMinutes = toMinutes(endTime) - toMinutes(startTime);

  if (durationMinutes <= 0) {
    return "-";
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function getDurationHours(startTime, endTime) {
  return Math.max(0, (toMinutes(endTime) - toMinutes(startTime)) / 60);
}

function addDaysToDateString(dateString, days) {
  const parsed = parseDateInput(dateString);
  if (!parsed) return dateString;

  parsed.setDate(parsed.getDate() + days);
  return formatDateInput(parsed);
}

function getBookingDatesInRange(startDateString, endDateString) {
  const startDate = parseDateInput(startDateString);
  const endDate = parseDateInput(endDateString || startDateString);

  if (!startDate || !endDate || endDate < startDate) {
    return [];
  }

  const rangeDays = Math.floor((endDate - startDate) / MS_PER_DAY) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return [];
  }

  const dates = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    if (!isWeekendDate(cursor)) {
      dates.push(formatDateInput(cursor));
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function isActiveBooking(booking) {
  return ["pending", "approved", "class"].includes(booking.status);
}

function bookingOverlaps(booking, startTime, endTime) {
  return (
    startTime < normalizeTime(booking.end_time) &&
    endTime > normalizeTime(booking.start_time)
  );
}

function getSlotBooking(bookings, startTime, endTime) {
  return bookings.find(
    (booking) =>
      isActiveBooking(booking) && bookingOverlaps(booking, startTime, endTime),
  );
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

function isUnderMaintenance(item) {
  return item?.status === "maintenance";
}

export default function LabReservationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
          <section className="rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
            <p className="rounded-lg border border-border-light bg-white px-3 py-4 text-sm text-text-muted">
              Loading lab reservation...
            </p>
          </section>
        </main>
      }
    >
      <LabReservationContent />
    </Suspense>
  );
}

function LabReservationContent() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultBookingDate = getDefaultBookingDateString();
  const initialDate = searchParams.get("date") || defaultBookingDate;
  const initialStart = searchParams.get("start") || "09:00";
  const initialEnd = searchParams.get("end") || addHour(initialStart);
  const rescheduleFrom = searchParams.get("rescheduleFrom") || "";

  const [lab, setLab] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [bookingEndDate, setBookingEndDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [usage, setUsage] = useState("");
  const [votNumber, setVotNumber] = useState("");
  const [token, setToken] = useState("");
  const [requesterProfile, setRequesterProfile] = useState(null);
  const [requesterRole, setRequesterRole] = useState("");
  const [requesterIdentifier, setRequesterIdentifier] = useState("");
  const [requesterFaculty, setRequesterFaculty] = useState("");
  const [requesterContact, setRequesterContact] = useState("");
  const [picDetails, setPicDetails] = useState(null);
  const [picDetailsMessage, setPicDetailsMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [localDateWarning, setLocalDateWarning] = useState("");

  useEffect(() => {
    const parsedSelectedDate = parseDateInput(selectedDate);

    if (!parsedSelectedDate) {
      setSelectedDate(defaultBookingDate);
      return;
    }

    if (!isBookingDateAllowed(parsedSelectedDate)) {
      if (isWeekendDate(parsedSelectedDate)) {
        setLocalDateWarning(
          "Weekends are not allowed. Date changed to the next valid weekday.",
        );
      } else if (parsedSelectedDate < getMinBookingDate()) {
        setLocalDateWarning(
          "Bookings must be at least 7 days in advance. Date adjusted automatically.",
        );
      }

      setSelectedDate(defaultBookingDate);
      return;
    }

    setLocalDateWarning("");
  }, [defaultBookingDate, selectedDate]);

  useEffect(() => {
    const startDate = parseDateInput(selectedDate);
    const endDate = parseDateInput(bookingEndDate);

    if (!startDate || !endDate || endDate < startDate) {
      setBookingEndDate(selectedDate);
      return;
    }

    const rangeDays = Math.floor((endDate - startDate) / MS_PER_DAY) + 1;
    if (rangeDays > MAX_RANGE_DAYS) {
      setBookingEndDate(addDaysToDateString(selectedDate, MAX_RANGE_DAYS - 1));
    }
  }, [bookingEndDate, selectedDate]);

  useEffect(() => {
    let isMounted = true;

    async function loadRequesterProfile() {
      const { data: userData, error: userError } = await getCurrentUser();

      if (!isMounted || userError || !userData?.user?.email) {
        return;
      }

      const { data: profile, error: profileError } = await getRecordByColumn(
        "users",
        "email",
        userData.user.email,
        "id, username, email, role",
      );

      if (!isMounted || profileError || !profile) {
        return;
      }

      setRequesterProfile(profile);
      setRequesterRole(profile.role || "");
    }

    loadRequesterProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const formattedToken = token.trim().toUpperCase();

    async function loadPicDetails() {
      setPicDetails(null);
      setPicDetailsMessage("");

      if (requesterRole === "pic" && requesterProfile) {
        setPicDetails(requesterProfile);
        return;
      }

      if (!formattedToken || formattedToken.length !== 6 || !requesterProfile?.id) {
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data: assignedToken, error: tokenError } = await supabase
        .from("pic_tokens")
        .select("assigned_by, expires_at, manual_expire")
        .eq("token", formattedToken)
        .eq("assigned_to", requesterProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isMounted) return;

      if (tokenError || !assignedToken) {
        setPicDetailsMessage("No PIC details found for this token.");
        return;
      }

      if (assignedToken.manual_expire) {
        setPicDetailsMessage("This token has been manually expired.");
        return;
      }

      if (new Date(assignedToken.expires_at).getTime() <= Date.now()) {
        setPicDetailsMessage("This token has expired.");
        return;
      }

      const { data: picUser, error: picError } = await supabase
        .from("users")
        .select("id, username, email, role")
        .eq("id", assignedToken.assigned_by)
        .maybeSingle();

      if (!isMounted) return;

      if (picError || !picUser) {
        setPicDetailsMessage("Could not load PIC details for this token.");
        return;
      }

      setPicDetails(picUser);
    }

    loadPicDetails();

    return () => {
      isMounted = false;
    };
  }, [requesterProfile, requesterRole, token]);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    async function loadLab() {
      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("labs")
        .select(
          "id, name, description, location, status, price_per_hour, course",
        )
        .eq("id", id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error || !data) {
        console.error(error);
        setErrorMessage("Could not load lab details.");
        setLab(null);
      } else {
        setLab(data);
      }

      setIsLoading(false);
    }

    loadLab();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    async function loadBookings() {
      const { data, error } = await supabase
        .from("lab_bookings")
        .select(
          "id, lab_id, user_id, booking_date, start_time, end_time, status",
        )
        .eq("lab_id", id)
        .eq("booking_date", selectedDate);

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error(error);
        setErrorMessage("Could not load lab availability.");
        setBookings([]);
      } else {
        const timetableEvents = getLabTimetableEvents(id, selectedDate).map(
          (event) => ({
            id: `class-${event.id}`,
            lab_id: id,
            status: "class",
            start_time: `${event.startTime}:00`,
            end_time: `${event.endTime}:00`,
            title: event.title,
          }),
        );

        setBookings([...(data || []), ...timetableEvents]);
      }
    }

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, [id, selectedDate]);

  function changeDate(days) {
    const currentDate = parseDateInput(selectedDate);
    if (!currentDate) {
      setSelectedDate(defaultBookingDate);
      return;
    }

    setSelectedDate(
      formatDateForDB(getAdjacentAllowedBookingDate(currentDate, days)),
    );
  }

  const conflict = getSlotBooking(bookings, startTime, endTime);
  const timetableConflict = findLabTimetableConflict({
    labId: id,
    date: selectedDate,
    startTime,
    endTime,
  });
  const isTimeValid = startTime < endTime;
  const isDateValid = isBookingDateStringAllowed(selectedDate);
  const isOfficeRangeValid = isOfficeTimeRange(startTime, endTime);
  const validationStatus = !isTimeValid
    ? "invalid"
    : isUnderMaintenance(lab)
      ? "maintenance"
    : !isDateValid
      ? "date_invalid"
      : !isOfficeRangeValid
        ? "office_hours_invalid"
        : timetableConflict
          ? "class"
    : conflict
      ? getSlotStatus(conflict)
      : "available";
  const durationText = formatDuration(startTime, endTime);
  const bookingDates = getBookingDatesInRange(selectedDate, bookingEndDate);
  const bookingDayCount = Math.max(bookingDates.length, 1);
  const total =
    getDurationHours(startTime, endTime) *
    (lab?.price_per_hour || 0) *
    bookingDayCount;
  const isPicRequester = requesterRole === "pic";
  const hasCompleteBookingFields = Boolean(
    selectedDate &&
      bookingEndDate &&
      startTime &&
      endTime &&
      usage.trim() &&
      votNumber.trim() &&
      requesterIdentifier.trim() &&
      requesterFaculty.trim() &&
      requesterContact.trim() &&
      bookingDates.length > 0 &&
      (isPicRequester || token.trim()),
  );
  const canSubmit =
    validationStatus === "available" &&
    hasCompleteBookingFields &&
    !isSubmitting;

  function getQuotationPayload(quotationNumber = "DRAFT") {
    return {
      bookingType: "Lab Booking",
      quotationNumber,
      resourceName: lab?.name || "Lab",
      resourceId: lab?.id || id,
      requester: requesterProfile || {},
      requesterIdentifier: requesterIdentifier.trim(),
      requesterFaculty: requesterFaculty.trim(),
      requesterContact: requesterContact.trim(),
      pic: picDetails || (isPicRequester ? requesterProfile : {}),
      picCode: isPicRequester ? "PIC account - no token required" : token.trim().toUpperCase(),
      startDate: selectedDate,
      endDate: bookingEndDate,
      startTime,
      endTime,
      bookingDayCount,
      durationHours: getDurationHours(startTime, endTime),
      pricePerHour: lab?.price_per_hour || 0,
      totalPrice: total,
      votNumber: votNumber.trim(),
      purpose: usage.trim(),
      resourceLocation: lab?.location || "",
      resourceStatus: lab?.status || "",
      resourceCourse: lab?.course || "",
      resourceDescription: lab?.description || "",
    };
  }

  function handleMockQuotationDownload() {
    downloadQuotationPdf(getQuotationPayload("DRAFT"));
  }

  async function saveQuotation({ accessToken, responseData, quotationPayload }) {
    const bookingRows = responseData.bookings || [responseData.booking];
    const bookingIds = bookingRows
      .map((booking) => Number(booking?.id))
      .filter((bookingId) => Number.isInteger(bookingId) && bookingId > 0);

    if (!bookingIds.length) {
      return { quotationPayload };
    }

    const quotationResponse = await fetch("/api/booking-quotations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        bookingType: "lab",
        primaryBookingId: Number(responseData.booking.id),
        bookingIds,
        quotationNumber: quotationPayload.quotationNumber,
        quotationPayload,
      }),
    });
    const quotationData = await quotationResponse.json();

    if (!quotationResponse.ok) {
      return {
        error: quotationData?.error || "Could not save quotation.",
        quotationPayload,
      };
    }

    return {
      quotationPayload:
        quotationData?.quotation?.quotation_payload || quotationPayload,
    };
  }

  function handleSubmitBooking(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setShowAgreementModal(true);
  }

  async function submitBookingRequest() {

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const formattedToken = token.trim().toUpperCase();
    setShowAgreementModal(false);

    if (validationStatus !== "available") {
      setErrorMessage(
        validationStatus === "date_invalid"
          ? "Bookings must be at least 7 days in advance on weekdays."
          : validationStatus === "office_hours_invalid"
            ? "Bookings must be within office hours (08:00 to 18:00)."
            : validationStatus === "class"
              ? "This slot clashes with the teaching timetable."
              : validationStatus === "maintenance"
                ? "This lab is under maintenance and cannot be booked."
              : "Time slot not available. Please select another time.",
      );
      return;
    }

    if (!usage.trim()) {
      setErrorMessage("Please describe your usage purpose.");
      return;
    }

    if (bookingDates.length === 0) {
      setErrorMessage("Please select a valid booking range up to 2 weeks.");
      return;
    }

    if (!votNumber.trim()) {
      setErrorMessage("Please enter your VOT number.");
      return;
    }

    if (
      !requesterIdentifier.trim() ||
      !requesterFaculty.trim() ||
      !requesterContact.trim()
    ) {
      setErrorMessage("Please enter your ID, faculty, and contact number.");
      return;
    }

    if (!isPicRequester && !formattedToken) {
      setErrorMessage("Please enter your authorization token.");
      return;
    }

    try {
      setIsSubmitting(true);

      const { data: sessionData } = await getCurrentSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setErrorMessage("Please log in before booking a lab.");
        return;
      }

      const response = await fetch("/api/lab-bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          labId: id,
          bookingDate: selectedDate,
          bookingEndDate,
          startTime: `${startTime}:00`,
          endTime: `${endTime}:00`,
          picCode: isPicRequester ? "" : formattedToken,
          bookingReason: usage.trim(),
          grantNumber: "",
          votNumber: votNumber.trim(),
          requesterIdentifier: requesterIdentifier.trim(),
          requesterFaculty: requesterFaculty.trim(),
          requesterContact: requesterContact.trim(),
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setErrorMessage(
          responseData?.error || "Booking failed. Please try again.",
        );
        return;
      }

      if (!responseData?.booking) {
        setErrorMessage("Booking submitted, but booking details are missing.");
        return;
      }

      setSuccessMessage(
        responseData.message || "Lab booking submitted. Waiting for approval.",
      );
      const quotationPayload = getQuotationPayload(
        `QTN-LAB-${responseData.booking.id}`,
      );
      const quotationSaveResult = await saveQuotation({
        accessToken,
        responseData,
        quotationPayload,
      });

      if (quotationSaveResult.error) {
        setSuccessMessage(
          `${responseData.message || "Lab booking submitted. Waiting for approval."} ${quotationSaveResult.error}`,
        );
      }

      downloadQuotationPdf(quotationSaveResult.quotationPayload);
      setBookings((currentBookings) => [
        ...currentBookings,
        ...(responseData.bookings || [responseData.booking]).filter(
          (booking) => booking?.booking_date === selectedDate,
        ),
      ]);
      setToken("");
      setUsage("");
      setVotNumber("");
      setRequesterIdentifier("");
      setRequesterFaculty("");
      setRequesterContact("");
      setShowAgreementModal(false);
    } catch (error) {
      console.error(error);
      setErrorMessage("Unexpected error while booking a lab.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
        <section className="rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
          <p className="rounded-lg border border-border-light bg-white px-3 py-4 text-sm text-text-muted">
            Loading lab reservation...
          </p>
        </section>
      </main>
    );
  }

  if (!lab) {
    return (
      <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
        <section className="rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
          <p className="rounded-lg border border-warning/20 bg-white px-3 py-4 text-sm text-warning">
            {errorMessage || "Lab not found."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
      <section className="min-h-[calc(100vh-7rem)] rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
        <form
          onSubmit={handleSubmitBooking}
          className="mx-auto max-w-6xl space-y-6"
        >
          <div className="space-y-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/lab-booking")}
              className="w-auto text-sm"
            >
              Back
            </Button>

            <div className="text-center">
              <h1 className="text-3xl font-semibold text-primary">
                Lab Reservation
              </h1>
              <p className="mt-2 text-sm uppercase tracking-wide text-text-muted">
                Laboratory Booking
              </p>
            </div>

            <div className="rounded-xl border border-border-light bg-white p-4 text-sm text-text-muted md:p-5">
              <p className="font-semibold text-primary">Before you submit</p>
              <p className="mt-2">
                Choose a free time slot, describe your research objective, then{" "}
                {isPicRequester
                  ? "submit the booking request for approval."
                  : "enter the 6-character authorization token assigned to your account by the PIC."}{" "}
                Submitted bookings stay pending until they are approved.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>Earliest booking date is 7 days from today.</li>
                <li>Weekends are not available for booking.</li>
                <li>Office hours only: 08:00 to 18:00.</li>
                <li>Class timetable slots are blocked automatically.</li>
              </ul>

              {rescheduleFrom ? (
                <p className="mt-3 rounded-lg border border-warning/20 bg-white px-3 py-2 text-warning">
                  You are creating a new booking request from approved booking {" "}
                  <span className="font-semibold">{rescheduleFrom}</span>. Your
                  original booking remains active.
                </p>
              ) : null}
            </div>
          </div>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              01 Laboratory
            </p>
            <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
              <h2 className="text-xl font-semibold text-text-main">
                {lab.name}
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                {lab.location || "Location not provided"}
              </p>
              <p className="mt-3 text-sm font-semibold text-primary">
                {formatRmFromUsd(lab.price_per_hour || 0)}/hr
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              02 User Details
            </p>
            <div className="grid gap-4 rounded-xl border border-border-light bg-white p-5 md:grid-cols-3 md:p-6">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Username
                </p>
                <Input value={requesterProfile?.username || ""} readOnly />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Role
                </p>
                <Input value={requesterProfile?.role || ""} readOnly />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Email
                </p>
                <Input value={requesterProfile?.email || ""} readOnly />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              03 Additional Requester Details
            </p>
            <div className="grid gap-4 rounded-xl border border-border-light bg-white p-5 md:grid-cols-3 md:p-6">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  ID
                </p>
                <Input
                  placeholder="Enter your ID"
                  value={requesterIdentifier}
                  onChange={(event) => setRequesterIdentifier(event.target.value)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Faculty
                </p>
                <Input
                  placeholder="Enter your faculty"
                  value={requesterFaculty}
                  onChange={(event) => setRequesterFaculty(event.target.value)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Contact Number
                </p>
                <Input
                  placeholder="Enter your contact number"
                  value={requesterContact}
                  onChange={(event) => setRequesterContact(event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              04 Availability Preview
            </p>
            <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
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
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedDate(defaultBookingDate)}
                    className="w-auto"
                  >
                    Earliest
                  </Button>

                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(event) =>
                      event.target.value && setSelectedDate(event.target.value)
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

              <div className="overflow-x-auto pb-2">
                <p className="mb-3 text-xs text-text-muted">
                  Tip: scroll sideways to view all time slots.
                </p>
                <div className="min-w-[1180px]">
                  <div className="grid grid-cols-[150px_repeat(10,1fr)] gap-3 pb-3 text-sm font-semibold text-text-main">
                    <div className="text-xs uppercase tracking-wide text-text-muted">
                      Lab Resource
                    </div>
                    {START_TIMES.map((time) => (
                      <div key={time} className="text-center">
                        {time}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-[150px_repeat(10,1fr)] items-center gap-3">
                    <div>
                      <p className="font-semibold text-text-main">{lab.name}</p>
                      <p className="text-sm text-text-muted">
                        {lab.location || "-"}
                      </p>
                    </div>

                    {START_TIMES.map((time) => {
                      const slotEnd = addHour(time);
                      const booking = getSlotBooking(bookings, time, slotEnd);
                      const status = getSlotStatus(booking);

                      if (isUnderMaintenance(lab)) {
                        return (
                          <div
                            key={time}
                            className="flex h-20 flex-col items-center justify-center rounded-xl border border-yellow-200 bg-yellow-50 px-2 text-center text-xs font-semibold text-yellow-700"
                          >
                            <span>Maintenance</span>
                            <span className="mt-1 text-[11px] font-normal text-text-muted">
                              Unavailable
                            </span>
                          </div>
                        );
                      }

                      if (status === "available") {
                        return (
                          <button
                            type="button"
                            key={time}
                            onClick={() => {
                              setStartTime(time);
                              setEndTime(slotEnd);
                            }}
                            className="flex h-20 items-center justify-center rounded-xl border border-green-200 bg-green-50 px-2 text-center text-xs font-semibold text-green-700 transition-colors hover:border-primary hover:bg-background-main focus:border-primary focus:outline-none"
                          >
                            Available
                          </button>
                        );
                      }

                      return (
                        <div
                          key={time}
                          className={`flex h-20 flex-col items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold ${
                            status === "pending"
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
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              05 Date and Time Selection
            </p>
            <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Start Date
                  </p>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      setSelectedDate(event.target.value);
                      if (bookingEndDate < event.target.value) {
                        setBookingEndDate(event.target.value);
                      }
                    }}
                    min={getMinBookingDateString()}
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    End Date
                  </p>
                  <Input
                    type="date"
                    value={bookingEndDate}
                    onChange={(event) =>
                      event.target.value && setBookingEndDate(event.target.value)
                    }
                    min={selectedDate}
                    max={addDaysToDateString(selectedDate, MAX_RANGE_DAYS - 1)}
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Booking Days
                  </p>
                  <div className="flex h-11 items-center rounded-xl border border-border-light bg-background-main px-3 text-text-muted">
                    {bookingDates.length} weekday
                    {bookingDates.length === 1 ? "" : "s"} selected
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Start Time
                  </p>
                  <select
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-text-main outline-none transition-colors focus:border-primary"
                  >
                    {START_TIMES.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    End Time
                  </p>
                  <select
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-text-main outline-none transition-colors focus:border-primary"
                  >
                    {END_TIMES.filter((time) => time > startTime).map(
                      (time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Suggested Slots
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {SUGGESTED_SLOTS.map(([suggestedStart, suggestedEnd]) => {
                    const suggestedConflict = getSlotBooking(
                      bookings,
                      suggestedStart,
                      suggestedEnd,
                    );
                    const slotAvailable =
                      !suggestedConflict && !isUnderMaintenance(lab);

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
                          {formatDuration(suggestedStart, suggestedEnd)}
                        </p>
                        <p
                          className={`mt-3 text-sm font-semibold ${
                            slotAvailable ? "text-primary" : "text-warning"
                          }`}
                        >
                          {slotAvailable
                            ? "Quick Select"
                            : isUnderMaintenance(lab)
                              ? "Maintenance"
                              : "Not Available"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className={`mt-6 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  validationStatus === "available"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : validationStatus === "pending"
                      ? "border-purple-200 bg-purple-50 text-purple-700"
                      : "border-warning/20 bg-white text-warning"
                }`}
              >
              {validationStatus === "available"
                ? "Slot is available"
                : validationStatus === "maintenance"
                  ? "This lab is under maintenance"
                : validationStatus === "pending"
                  ? "Slot currently requested by another user"
                    : validationStatus === "class"
                      ? "Slot blocked by class timetable"
                    : validationStatus === "date_invalid"
                      ? "Date must be on a weekday and at least 7 days ahead"
                    : validationStatus === "office_hours_invalid"
                      ? "Time must be within office hours (08:00 to 18:00)"
                    : validationStatus === "invalid"
                      ? "End time must be after start time"
                      : "Time slot conflicts with an existing booking"}
              </div>
              <p className="mt-3 text-sm text-text-muted">
                Date ranges can cover up to 2 weeks. Weekend dates are skipped.
                Daily duration: {durationText}.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              06 Equipment
            </p>
            <div className="rounded-xl border border-border-light bg-white px-4 py-4 text-sm text-text-muted">
              Basic equipment will be provided with your lab booking.
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              07 Usage Context
            </p>
            <textarea
              rows={6}
              placeholder="Briefly describe research objective..."
              className="w-full rounded-xl border border-border-light bg-white p-3 text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-primary"
              value={usage}
              onChange={(event) => setUsage(event.target.value)}
            />
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              08 Billing
            </p>
            <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                VOT Number
              </p>
              <Input
                placeholder="Enter VOT number"
                value={votNumber}
                onChange={(event) => setVotNumber(event.target.value)}
              />

              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Total Price
                </p>
                <Input value={formatRmFromUsd(total)} readOnly />
              </div>

              <p className="mt-3 text-sm text-text-muted">
                Any VOT number is accepted for now. Payment will be processed
                once the request has been approved.
              </p>
            </div>
          </section>

          {!isPicRequester ? (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                09 Authorization Token
              </p>
              <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
                <p className="mb-3 text-sm text-text-muted">
                  Enter the 6-character token assigned to your account by the PIC.
                  Tokens cannot be shared between users and can be reused until
                  they expire.
                </p>
                <Input
                  placeholder="Enter your token"
                  value={token}
                  maxLength={6}
                  onChange={(event) => setToken(event.target.value.toUpperCase())}
                />

                {picDetails ? (
                  <div className="mt-4 grid gap-4 rounded-xl border border-border-light bg-background-main p-4 md:grid-cols-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        PIC Username
                      </p>
                      <p className="text-sm font-medium text-text-main">
                        {picDetails.username || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        PIC Role
                      </p>
                      <p className="text-sm font-medium text-text-main">
                        {picDetails.role || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        PIC Email
                      </p>
                      <p className="break-words text-sm font-medium text-text-main">
                        {picDetails.email || "-"}
                      </p>
                    </div>
                  </div>
                ) : null}

                {picDetailsMessage ? (
                  <p className="mt-3 rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
                    {picDetailsMessage}
                  </p>
                ) : null}

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
            </section>
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

          <div className="flex flex-col gap-4 border-t border-border-light pt-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Est. Total
              </p>
              <p className="text-3xl font-semibold text-primary">
                {formatRmFromUsd(total)}
              </p>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <Button
                type="button"
                variant="secondary"
                onClick={handleMockQuotationDownload}
                className="md:w-auto"
              >
                Download Mock Quotation PDF
              </Button>
              <Button type="submit" disabled={!canSubmit} className="md:w-auto">
                {isSubmitting
                  ? "Submitting..."
                  : successMessage
                    ? "Booking Successful"
                  : validationStatus === "available"
                    ? "Confirm Booking"
                    : validationStatus === "maintenance"
                      ? "Under Maintenance"
                      : "Cannot Book - Conflict"}
              </Button>
            </div>
          </div>
        </form>

        {showAgreementModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
            <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-light bg-white p-5 shadow-xl md:p-6">
              <h2 className="text-xl font-semibold text-text-main">
                Confirm Agreement
              </h2>

              <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                {[
                  ["Requester", requesterProfile?.username || "-"],
                  ["Resource", lab.name],
                  ["Request Type", "Lab Booking"],
                  [
                    "Date Range",
                    selectedDate === bookingEndDate
                      ? selectedDate
                      : `${selectedDate} to ${bookingEndDate}`,
                  ],
                  [
                    "Booking Days",
                    `${bookingDates.length} weekday${
                      bookingDates.length === 1 ? "" : "s"
                    }`,
                  ],
                  ["Time", `${startTime} - ${endTime}`],
                  ["VOT Number", votNumber || "-"],
                  ["PIC", picDetails?.username || "-"],
                  ["Estimated Total", formatRmFromUsd(total)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border-light bg-background-main p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {label}
                    </p>
                    <p className="mt-1 break-words font-medium text-text-main">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-border-light bg-background-main p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Purpose
                </p>
                <p className="mt-1 text-text-main">{usage || "-"}</p>
              </div>

              <p className="mt-4 rounded-xl border border-primary/20 bg-background-main p-4 text-sm text-text-main">
                {BOOKING_AGREEMENT_TEXT}
              </p>

              <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAgreementModal(false)}
                  className="md:w-auto"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitBookingRequest}
                  className="md:w-auto"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "I Agree"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
