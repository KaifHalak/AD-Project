import { getWeekdayKey, timeRangesOverlap } from "@/lib/bookingConstraints";

export const weeklyTimetable = [
  {
    id: "LAB001",
    title: "BIO101 Practical",
    weekday: "monday",
    labId: "LAB001",
    equipmentIds: ["MIC-01", "MIC-02"],
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    id: "tt-tue-lab-b-che-201",
    title: "CHE201 Experiment",
    weekday: "tuesday",
    labId: "LAB-B",
    equipmentIds: ["SPEC-01", "HEAT-01"],
    startTime: "10:00",
    endTime: "12:00",
  },
  {
    id: "tt-wed-lab-c-phy-120",
    title: "PHY120 Session",
    weekday: "wednesday",
    labId: "LAB-C",
    equipmentIds: ["OSC-01", "PSU-01"],
    startTime: "13:00",
    endTime: "15:00",
  },
  {
    id: "tt-thu-lab-a-csc-230",
    title: "CSC230 Lab",
    weekday: "thursday",
    labId: "LAB-A",
    equipmentIds: ["PC-01", "PC-02"],
    startTime: "14:00",
    endTime: "16:00",
  },
  {
    id: "tt-fri-lab-d-eng-110",
    title: "ENG110 Workshop",
    weekday: "friday",
    labId: "LAB-D",
    equipmentIds: ["PRINT-01", "CUT-01"],
    startTime: "08:00",
    endTime: "10:00",
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
