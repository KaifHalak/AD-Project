import {
  formatDateInput,
  isBookingDateStringAllowed,
  isOfficeTimeRange,
  isWeekendDate,
  parseDateInput,
  timeRangesOverlap,
  toMinutes,
} from "@/lib/bookingConstraints";
import { findLabTimetableConflict } from "@/lib/mockTimetable";

export const BOOKING_REQUEST_STORAGE_KEY = "bookingRequestItems";
export const BOOKING_REQUEST_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const MAX_BOOKING_RANGE_DAYS = 14;
export const ACTIVE_EQUIPMENT_STATUSES = [
  "pending",
  "under_unit_leader_review",
  "under_ppmu_review",
  "approved",
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function notifyBookingRequestUpdated() {
  window.dispatchEvent(new Event("booking-request-updated"));
}

export function clearStoredBookingRequestItems() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(BOOKING_REQUEST_STORAGE_KEY);
  notifyBookingRequestUpdated();
}

export function getStoredBookingRequestItems() {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(BOOKING_REQUEST_STORAGE_KEY);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    const expiresAt = Number(parsed?.expiresAt || 0);
    if (!expiresAt || expiresAt <= Date.now()) {
      clearStoredBookingRequestItems();
      return [];
    }

    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    clearStoredBookingRequestItems();
    return [];
  }
}

export function saveStoredBookingRequestItems(items) {
  if (typeof window === "undefined") return;

  const safeItems = Array.isArray(items) ? items : [];

  if (safeItems.length === 0) {
    clearStoredBookingRequestItems();
    return;
  }

  window.localStorage.setItem(
    BOOKING_REQUEST_STORAGE_KEY,
    JSON.stringify({
      items: safeItems,
      expiresAt: Date.now() + BOOKING_REQUEST_EXPIRY_MS,
    }),
  );
  notifyBookingRequestUpdated();
}

export function getBookingDates(startDateString, endDateString) {
  const startDate = parseDateInput(startDateString);
  const endDate = parseDateInput(endDateString || startDateString);

  if (!startDate || !endDate || endDate < startDate) {
    return { error: "Please select a valid booking date range." };
  }

  const rangeDays = Math.floor((endDate - startDate) / MS_PER_DAY) + 1;
  if (rangeDays > MAX_BOOKING_RANGE_DAYS) {
    return { error: "Bookings can cover a maximum of 2 weeks." };
  }

  const dates = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    if (!isWeekendDate(cursor)) {
      const dateString = formatDateInput(cursor);

      if (!isBookingDateStringAllowed(dateString)) {
        return {
          error:
            "Bookings must be made at least 7 days in advance on weekdays.",
        };
      }

      dates.push(dateString);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (dates.length === 0) {
    return { error: "Please select at least one weekday for the booking." };
  }

  return { dates };
}

export function validateBookingItem(item) {
  const equipmentId = String(item?.equipmentId || "").trim();
  const startDate = String(item?.startDate || "").trim();
  const endDate = String(item?.endDate || item?.startDate || "").trim();
  const startTime = String(item?.startTime || "").trim().slice(0, 5);
  const endTime = String(item?.endTime || "").trim().slice(0, 5);
  const bookingReason = String(item?.bookingReason || "").trim();

  if (!equipmentId || !startDate || !startTime || !endTime) {
    return { error: "Every item needs equipment, date, start time, and end time." };
  }

  if (!isOfficeTimeRange(startTime, endTime)) {
    return { error: "Bookings must be within office hours (08:00 to 18:00)." };
  }

  const datesResult = getBookingDates(startDate, endDate);
  if (datesResult.error) {
    return { error: datesResult.error };
  }

  return {
    item: {
      equipmentId,
      startDate,
      endDate: endDate || startDate,
      startTime,
      endTime,
      bookingReason,
      bookingDates: datesResult.dates,
    },
  };
}

export function calculateItemTotal({ pricePerHour, startTime, endTime, dayCount }) {
  const durationHours = Math.max(0, (toMinutes(endTime) - toMinutes(startTime)) / 60);
  return Number((durationHours * Number(pricePerHour || 0) * dayCount).toFixed(2));
}

export function deriveOverallStatus(items = []) {
  if (items.length === 0) return "pending";
  if (items.every((item) => item.status === "cancelled")) return "cancelled";

  const activeItems = items.filter((item) => item.status !== "cancelled");
  if (activeItems.length === 0) return "cancelled";
  if (activeItems.every((item) => item.status === "approved")) return "approved";
  if (activeItems.every((item) => item.status === "rejected")) return "rejected";

  const hasApproved = activeItems.some((item) => item.status === "approved");
  const hasRejected = activeItems.some((item) => item.status === "rejected");
  if (hasApproved && hasRejected) return "partially_approved";

  return "pending";
}

export function getDisplayStatus(status) {
  switch (status) {
    case "approved":
      return "Approved";
    case "partially_approved":
      return "Partially Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

export function hasDateOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return String(leftStart) <= String(rightEnd) && String(leftEnd) >= String(rightStart);
}

export function itemConflictsWithRequest(left, right) {
  if (String(left.lab_id) !== String(right.lab_id)) return false;
  if (!hasDateOverlap(left.start_date, left.end_date, right.start_date, right.end_date)) {
    return false;
  }
  return timeRangesOverlap(left.start_time, left.end_time, right.start_time, right.end_time);
}

export function findTimetableConflictForItem(item) {
  for (const date of item.bookingDates || []) {
    const conflict = findLabTimetableConflict({
      labId: item.labId,
      date,
      startTime: item.startTime,
      endTime: item.endTime,
    });

    if (conflict) {
      return { date, conflict };
    }
  }

  return null;
}

export async function refreshParentStatus(admin, bookingId) {
  const { data: items, error } = await admin
    .from("equipment_bookings")
    .select("id, status")
    .eq("booking_id", bookingId);

  if (error) {
    console.error("Error refreshing booking status:", error);
    return { error };
  }

  const overallStatus = deriveOverallStatus(items || []);
  const { data, error: updateError } = await admin
    .from("bookings")
    .update({ overall_status: overallStatus, updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .select("*")
    .maybeSingle();

  return { data, error: updateError };
}
