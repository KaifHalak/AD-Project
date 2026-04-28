export const BOOKING_ADVANCE_DAYS = 7;
export const OFFICE_START_TIME = "08:00";
export const OFFICE_END_TIME = "18:00";

export const START_TIME_OPTIONS = [
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

export const END_TIME_OPTIONS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function padTo2(value) {
  return String(value).padStart(2, "0");
}

export function formatDateInput(date) {
  return `${date.getFullYear()}-${padTo2(date.getMonth() + 1)}-${padTo2(date.getDate())}`;
}

export function parseDateInput(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  parsed.setHours(0, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function getTodayDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function getMinBookingDate() {
  const minDate = getTodayDate();
  minDate.setDate(minDate.getDate() + BOOKING_ADVANCE_DAYS);
  return minDate;
}

export function getMinBookingDateString() {
  return formatDateInput(getMinBookingDate());
}

export function isWeekendDate(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isBookingDateAllowed(date) {
  const minDate = getMinBookingDate();
  return date >= minDate && !isWeekendDate(date);
}

export function isBookingDateStringAllowed(dateString) {
  const parsed = parseDateInput(dateString);
  if (!parsed) {
    return false;
  }

  return isBookingDateAllowed(parsed);
}

export function getNextAllowedBookingDate(fromDate = getMinBookingDate()) {
  const nextDate = new Date(fromDate);
  nextDate.setHours(0, 0, 0, 0);

  while (!isBookingDateAllowed(nextDate)) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate;
}

export function getAdjacentAllowedBookingDate(baseDate, direction = 1) {
  const step = direction >= 0 ? 1 : -1;
  const minDate = getMinBookingDate();
  const cursor = new Date(baseDate);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + step);

  if (step < 0 && cursor < minDate) {
    return minDate;
  }

  while (true) {
    if (cursor < minDate) {
      return minDate;
    }

    if (!isWeekendDate(cursor)) {
      return cursor;
    }

    cursor.setDate(cursor.getDate() + step);
  }
}

export function getDefaultBookingDateString() {
  return formatDateInput(getNextAllowedBookingDate());
}

export function normalizeTimeValue(time) {
  return String(time || "").trim().slice(0, 5);
}

export function toMinutes(time) {
  const normalized = normalizeTimeValue(time);
  const [hours, minutes] = normalized.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return NaN;
  }

  return hours * 60 + minutes;
}

export function isOfficeTimeRange(startTime, endTime) {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
    return false;
  }

  const officeStart = toMinutes(OFFICE_START_TIME);
  const officeEnd = toMinutes(OFFICE_END_TIME);

  return (
    startMinutes >= officeStart &&
    endMinutes <= officeEnd &&
    startMinutes < endMinutes
  );
}

export function timeRangesOverlap(startA, endA, startB, endB) {
  const startAMinutes = toMinutes(startA);
  const endAMinutes = toMinutes(endA);
  const startBMinutes = toMinutes(startB);
  const endBMinutes = toMinutes(endB);

  if (
    Number.isNaN(startAMinutes) ||
    Number.isNaN(endAMinutes) ||
    Number.isNaN(startBMinutes) ||
    Number.isNaN(endBMinutes)
  ) {
    return false;
  }

  return startAMinutes < endBMinutes && endAMinutes > startBMinutes;
}

export function getWeekdayKey(dateInput) {
  const parsed =
    dateInput instanceof Date ? dateInput : parseDateInput(String(dateInput));

  if (!parsed) {
    return "";
  }

  return WEEKDAY_KEYS[parsed.getDay()] || "";
}
