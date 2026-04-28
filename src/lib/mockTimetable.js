import { getWeekdayKey, timeRangesOverlap } from "@/lib/bookingConstraints";

export const weeklyTimetable = [
  {
    id: "tt-mon-chem-lab001",
    title: "Chemical Engineering Practical",
    weekday: "monday",
    labId: "LAB001",
    equipmentIds: ["MS-A4521", "UC-B7832", "CI-A7651"],
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    id: "tt-tue-chem-lab002",
    title: "Molecular Spectroscopy Session",
    weekday: "tuesday",
    labId: "LAB002",
    equipmentIds: ["MS-A4521", "UC-B7832", "CI-A7651"],
    startTime: "10:00",
    endTime: "12:00",
  },
  {
    id: "tt-wed-mech-lab003",
    title: "Mechanical Engineering Workshop",
    weekday: "wednesday",
    labId: "LAB003",
    equipmentIds: ["3DP-M823", "CM-A9214", "EM-C5673", "TE-1234"],
    startTime: "13:00",
    endTime: "15:00",
  },
  {
    id: "tt-thu-software-lab004",
    title: "Software Engineering Lab",
    weekday: "thursday",
    labId: "LAB004",
    equipmentIds: ["FC-B4392"],
    startTime: "14:00",
    endTime: "16:00",
  },
  {
    id: "tt-fri-software-lab005",
    title: "Cybersecurity Lab Session",
    weekday: "friday",
    labId: "LAB005",
    equipmentIds: ["FC-B4392"],
    startTime: "08:00",
    endTime: "10:00",
  },
  {
    id: "tt-fri-electrical-lab006",
    title: "Electrical Engineering Practical",
    weekday: "friday",
    labId: "LAB006",
    equipmentIds: ["OSC-E3421"],
    startTime: "10:00",
    endTime: "12:00",
  },
];

function normalizeId(id) {
  return String(id || "").trim().toLowerCase();
}

function matchesResourceId(eventId, targetId) {
  const normalizedEventId = normalizeId(eventId);
  const normalizedTargetId = normalizeId(targetId);

  if (!normalizedEventId || !normalizedTargetId) {
    return false;
  }

  return (
    normalizedEventId === normalizedTargetId ||
    normalizedEventId.includes(normalizedTargetId) ||
    normalizedTargetId.includes(normalizedEventId)
  );
}

export function getTimetableEventsForDate(dateInput) {
  const weekday = getWeekdayKey(dateInput);
  if (!weekday) {
    return [];
  }

  return weeklyTimetable.filter((event) => event.weekday === weekday);
}

export function getLabTimetableEvents(labId, dateInput) {
  return getTimetableEventsForDate(dateInput).filter(
    (event) => matchesResourceId(event.labId, labId),
  );
}

export function getEquipmentTimetableEvents(equipmentId, dateInput) {
  return getTimetableEventsForDate(dateInput).filter((event) =>
    (event.equipmentIds || []).some(
      (linkedEquipmentId) => matchesResourceId(linkedEquipmentId, equipmentId),
    ),
  );
}

export function findLabTimetableConflict({
  labId,
  date,
  startTime,
  endTime,
}) {
  return getLabTimetableEvents(labId, date).find((event) =>
    timeRangesOverlap(startTime, endTime, event.startTime, event.endTime),
  );
}

export function findEquipmentTimetableConflict({
  equipmentId,
  date,
  startTime,
  endTime,
}) {
  return getEquipmentTimetableEvents(equipmentId, date).find((event) =>
    timeRangesOverlap(startTime, endTime, event.startTime, event.endTime),
  );
}
