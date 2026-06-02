"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getCurrentSession, getCurrentUser } from "@/lib/supabase/auth";
import { getRecordByColumn } from "@/lib/supabase/db";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";
import { formatRmFromUsd } from "@/lib/currency";
import {
  BOOKING_AGREEMENT_TEXT,
  downloadQuotationPdf,
} from "@/lib/quotationPdf";
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

const MAX_RANGE_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDaysToDate(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getBookingDatesInRange(startDate, endDate) {
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

export default function EquipmentBookingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
          <section className="rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
            <p className="rounded-lg border border-border-light bg-white px-3 py-4 text-sm text-text-muted">
              Loading equipment...
            </p>
          </section>
        </main>
      }
    >
      <EquipmentBookingContent />
    </Suspense>
  );
}

function EquipmentBookingContent() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [equipment, setEquipment] = useState(null);
  const [bookings, setBookings] = useState([]);

  const [currentDate, setCurrentDate] = useState(
    parseDateInput(getDefaultBookingDateString()) || getMinBookingDate(),
  );
  const [bookingEndDate, setBookingEndDate] = useState(
    parseDateInput(getDefaultBookingDateString()) || getMinBookingDate(),
  );

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
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
        setBookingEndDate(parsed);
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

      if (
        !formattedToken ||
        formattedToken.length !== 6 ||
        !requesterProfile?.id
      ) {
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

  useEffect(() => {
    if (!bookingEndDate || Number.isNaN(bookingEndDate.getTime())) {
      setBookingEndDate(currentDate);
      return;
    }

    if (bookingEndDate < currentDate) {
      setBookingEndDate(currentDate);
      return;
    }

    const rangeDays =
      Math.floor((bookingEndDate - currentDate) / MS_PER_DAY) + 1;
    if (rangeDays > MAX_RANGE_DAYS) {
      setBookingEndDate(addDaysToDate(currentDate, MAX_RANGE_DAYS - 1));
    }
  }, [bookingEndDate, currentDate]);

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

  const selectedDateString = formatDateForDB(currentDate);
  const bookingEndDateString = formatDateForDB(bookingEndDate);
  const bookingDates = getBookingDatesInRange(currentDate, bookingEndDate);
  const bookingDayCount = Math.max(bookingDates.length, 1);

  //duration / total
  const durationMinutes = toMinutes(endTime) - toMinutes(startTime);
  const duration = Math.max(0, durationMinutes / 60);
  const total = duration * equipment.price_per_hour * bookingDayCount;

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
  const hasCompleteBookingFields = Boolean(
    selectedDateString &&
    bookingEndDateString &&
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
      bookingType: "Equipment Booking",
      quotationNumber,
      resourceName: equipment?.name || "Equipment",
      resourceId: equipment?.id || id,
      requester: requesterProfile || {},
      requesterIdentifier: requesterIdentifier.trim(),
      requesterFaculty: requesterFaculty.trim(),
      requesterContact: requesterContact.trim(),
      pic: picDetails || (isPicRequester ? requesterProfile : {}),
      picCode: isPicRequester
        ? "PIC account - no token required"
        : token.trim().toUpperCase(),
      startDate: selectedDateString,
      endDate: bookingEndDateString,
      startTime,
      endTime,
      bookingDayCount,
      durationHours: duration,
      pricePerHour: equipment?.price_per_hour || 0,
      totalPrice: total,
      votNumber: votNumber.trim(),
      purpose: usage.trim(),
      resourceLocation: equipment?.location || "",
      resourceStatus: equipment?.status || "",
      resourceCourse: equipment?.course || "",
      resourceDescription: equipment?.description || "",
      resourceQuantity: equipment?.quantity || "",
      resourceLabId: equipment?.lab_id || "",
    };
  }

  function handleMockQuotationDownload() {
    downloadQuotationPdf(getQuotationPayload("DRAFT"));
  }

  async function saveQuotation({ accessToken, bookingData, quotationPayload }) {
    const bookingRows = bookingData.bookings || [bookingData.booking];
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
        bookingType: "equipment",
        primaryBookingId: Number(bookingData.booking.id),
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

  //handle booking
  const handleSubmitBooking = (e) => {
    e?.preventDefault();

    if (!canSubmit) return;

    setErrorMessage("");
    setSuccessMessage("");
    setShowAgreementModal(true);
  };

  const submitBookingRequest = async () => {
    if (isSubmitting) return;

    setErrorMessage("");
    setSuccessMessage("");

    const formattedToken = token.trim().toUpperCase();
    setShowAgreementModal(false);

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
          bookingEndDate: bookingEndDateString,
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
      const quotationPayload = getQuotationPayload(
        `QTN-EQUIPMENT-${bookingData.booking.id}`,
      );
      const quotationSaveResult = await saveQuotation({
        accessToken,
        bookingData,
        quotationPayload,
      });

      if (quotationSaveResult.error) {
        setSuccessMessage(
          `${bookingData.message || "Booking submitted. Waiting for approval."} ${quotationSaveResult.error}`,
        );
      }

      downloadQuotationPdf(quotationSaveResult.quotationPayload);
      setBookings((currentBookings) => [
        ...currentBookings,
        ...(bookingData.bookings || [bookingData.booking]).filter(
          (booking) => booking?.booking_date === selectedDateString,
        ),
      ]);
      setToken("");
      setUsage("");
      setVotNumber("");
      setRequesterIdentifier("");
      setRequesterFaculty("");
      setRequesterContact("");
      router.push("/equipment-booking");
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
                You are creating a new booking request from approved booking{" "}
                <span className="font-semibold">{rescheduleFromId}</span>. Your
                original booking remains active.
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              01 User Details
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
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              02 Additional Requester Details
            </p>
            <div className="grid gap-4 rounded-xl border border-border-light bg-white p-5 md:grid-cols-3 md:p-6">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  ID
                </p>
                <Input
                  placeholder="Enter your ID"
                  value={requesterIdentifier}
                  onChange={(event) =>
                    setRequesterIdentifier(event.target.value)
                  }
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
          </div>

          <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
              03 Availability
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
              04 Date and Time Selection
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted">
                  START DATE
                </p>
                <Input
                  type="date"
                  value={selectedDateString}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const nextDate = parseDateInput(event.target.value);
                    if (!nextDate) return;
                    setCurrentDate(nextDate);
                    if (bookingEndDate < nextDate) {
                      setBookingEndDate(nextDate);
                    }
                  }}
                  min={getMinBookingDateString()}
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted">
                  END DATE
                </p>
                <Input
                  type="date"
                  value={bookingEndDateString}
                  onChange={(event) => {
                    const nextDate = parseDateInput(event.target.value);
                    if (nextDate) {
                      setBookingEndDate(nextDate);
                    }
                  }}
                  min={selectedDateString}
                  max={formatDateForDB(
                    addDaysToDate(currentDate, MAX_RANGE_DAYS - 1),
                  )}
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted">
                  BOOKING DAYS
                </p>
                <div className="rounded-xl border border-border-light bg-background-main px-3 py-3 text-text-main">
                  {bookingDates.length} weekday
                  {bookingDates.length === 1 ? "" : "s"} selected
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
                  {END_TIME_OPTIONS.filter((time) => time > startTime).map(
                    (time) => (
                      <option key={time}>{time}</option>
                    ),
                  )}
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
                    const bookingStart = toMinutes(
                      normalizeTime(booking.start_time),
                    );
                    const bookingEnd = toMinutes(
                      normalizeTime(booking.end_time),
                    );
                    return (
                      ["pending", "approved", "class"].includes(
                        booking.status,
                      ) &&
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
              <p className="mt-3 text-sm text-text-muted">
                Date ranges can cover up to 2 weeks. Weekend dates are skipped.
                Daily duration: {duration}h.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
              05 Usage Context
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
              06 Billing
            </p>
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
              Any VOT number is accepted for now. Payment will be processed once
              the request has been approved.
            </p>
          </div>

          {!isPicRequester ? (
            <div className="rounded-xl border border-border-light bg-white p-5 md:p-6">
              <p className="mb-2 text-xs font-semibold tracking-wide text-text-muted">
                07 PIC TOKEN
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
                08 EST. TOTAL
              </p>
              <p className="text-2xl font-semibold text-primary">
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
                Download Quotation PDF
              </Button>
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
        </div>

        {showAgreementModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
            <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-light bg-white p-5 shadow-xl md:p-6">
              <h2 className="text-xl font-semibold text-text-main">
                Confirm Agreement
              </h2>

              <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                {[
                  ["Requester", requesterProfile?.username || "-"],
                  ["Resource", equipment.name],
                  ["Request Type", "Equipment Booking"],
                  [
                    "Date Range",
                    selectedDateString === bookingEndDateString
                      ? selectedDateString
                      : `${selectedDateString} to ${bookingEndDateString}`,
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
