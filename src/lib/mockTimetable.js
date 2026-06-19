import { getWeekdayKey, timeRangesOverlap } from "@/lib/bookingConstraints";

export const weeklyTimetable = [
  // 15 June 2026 - Monday
  {
    id: "tt-2026-06-15-chem-lab01",
    title: "Chemical Engineering Practical",
    date: "2026-06-15",
    weekday: "monday",
    labId: "LAB01",
    equipmentIds: ["MS-A4521", "UC-B7832", "CI-A7651"],
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    id: "tt-2026-06-15-spectroscopy-lab02",
    title: "Molecular Spectroscopy Session",
    date: "2026-06-15",
    weekday: "monday",
    labId: "LAB02",
    equipmentIds: ["MS-A4521", "SPEC-M2210"],
    startTime: "10:30",
    endTime: "12:30",
  },

  // 16 June 2026 - Tuesday
  {
    id: "tt-2026-06-16-mech-lab03",
    title: "Mechanical Engineering Workshop",
    date: "2026-06-16",
    weekday: "tuesday",
    labId: "LAB03",
    equipmentIds: ["3DP-M823", "CM-A9214", "EM-C5673"],
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    id: "tt-2026-06-16-manufacturing-lab03",
    title: "Manufacturing Process Practical",
    date: "2026-06-16",
    weekday: "tuesday",
    labId: "LAB03",
    equipmentIds: ["CM-A9214", "LATHE-M3301"],
    startTime: "10:00",
    endTime: "12:00",
  },

  // 17 June 2026 - Wednesday
  {
    id: "tt-2026-06-17-software-lab04",
    title: "Software Engineering Lab",
    date: "2026-06-17",
    weekday: "wednesday",
    labId: "LAB04",
    equipmentIds: ["FC-B4392"],
    startTime: "14:00",
    endTime: "16:00",
  },
  {
    id: "tt-2026-06-17-database-lab05",
    title: "Database Systems Practical",
    date: "2026-06-17",
    weekday: "wednesday",
    labId: "LAB05",
    equipmentIds: ["FC-B4392"],
    startTime: "15:00",
    endTime: "17:00",
  },

  // 18 June 2026 - Thursday
  {
    id: "tt-2026-06-18-electrical-lab06",
    title: "Electrical Engineering Practical",
    date: "2026-06-18",
    weekday: "thursday",
    labId: "LAB06",
    equipmentIds: ["OSC-E3421", "PSU-E4412"],
    startTime: "08:00",
    endTime: "10:00",
  },
  {
    id: "tt-2026-06-18-circuit-lab06",
    title: "Circuit Analysis Lab",
    date: "2026-06-18",
    weekday: "thursday",
    labId: "LAB06",
    equipmentIds: ["OSC-E3421", "MM-E1120"],
    startTime: "09:30",
    endTime: "11:30",
  },

  // 19 June 2026 - Friday
  {
    id: "tt-2026-06-19-cybersecurity-lab05",
    title: "Cybersecurity Lab Session",
    date: "2026-06-19",
    weekday: "friday",
    labId: "LAB05",
    equipmentIds: ["FC-B4392", "SRV-N2201"],
    startTime: "08:00",
    endTime: "10:00",
  },
  {
    id: "tt-2026-06-19-networking-lab05",
    title: "Computer Networking Practical",
    date: "2026-06-19",
    weekday: "friday",
    labId: "LAB05",
    equipmentIds: ["RTR-N5510", "SW-N7710"],
    startTime: "09:00",
    endTime: "11:00",
  },

  // 22 June 2026 - Monday
  {
    id: "tt-2026-06-22-biotech-lab07",
    title: "Biotechnology Practical",
    date: "2026-06-22",
    weekday: "monday",
    labId: "LAB07",
    equipmentIds: ["MIC-B1102", "INC-B2103"],
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    id: "tt-2026-06-22-microbiology-lab08",
    title: "Microbiology Lab Session",
    date: "2026-06-22",
    weekday: "monday",
    labId: "LAB08",
    equipmentIds: ["MIC-B1102", "AUTO-B8810"],
    startTime: "10:00",
    endTime: "12:00",
  },

  // 23 June 2026 - Tuesday
  {
    id: "tt-2026-06-23-physics-lab09",
    title: "Applied Physics Experiment",
    date: "2026-06-23",
    weekday: "tuesday",
    labId: "LAB09",
    equipmentIds: ["LAS-P5501", "OSC-E3421"],
    startTime: "13:00",
    endTime: "15:00",
  },
  {
    id: "tt-2026-06-23-optics-lab09",
    title: "Optics and Laser Practical",
    date: "2026-06-23",
    weekday: "tuesday",
    labId: "LAB09",
    equipmentIds: ["LAS-P5501", "LEN-P2204"],
    startTime: "14:00",
    endTime: "16:00",
  },

  // 24 June 2026 - Wednesday
  {
    id: "tt-2026-06-24-ai-lab10",
    title: "Artificial Intelligence Lab",
    date: "2026-06-24",
    weekday: "wednesday",
    labId: "LAB10",
    equipmentIds: ["GPU-A9001", "FC-B4392"],
    startTime: "10:00",
    endTime: "12:00",
  },
  {
    id: "tt-2026-06-24-data-science-lab11",
    title: "Data Science Practical",
    date: "2026-06-24",
    weekday: "wednesday",
    labId: "LAB11",
    equipmentIds: ["GPU-A9001", "SRV-N2201"],
    startTime: "11:00",
    endTime: "13:00",
  },

  // 25 June 2026 - Thursday
  {
    id: "tt-2026-06-25-robotics-lab12",
    title: "Robotics Engineering Lab",
    date: "2026-06-25",
    weekday: "thursday",
    labId: "LAB12",
    equipmentIds: ["ROB-R1001", "SNS-R3302"],
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    id: "tt-2026-06-25-control-lab12",
    title: "Control Systems Practical",
    date: "2026-06-25",
    weekday: "thursday",
    labId: "LAB12",
    equipmentIds: ["ROB-R1001", "CTRL-R7731"],
    startTime: "10:30",
    endTime: "12:30",
  },

  // 26 June 2026 - Friday
  {
    id: "tt-2026-06-26-civil-lab13",
    title: "Civil Engineering Materials Lab",
    date: "2026-06-26",
    weekday: "friday",
    labId: "LAB13",
    equipmentIds: ["CTM-C8821", "CON-C3321"],
    startTime: "08:00",
    endTime: "10:00",
  },
  {
    id: "tt-2026-06-26-structural-lab14",
    title: "Structural Analysis Lab",
    date: "2026-06-26",
    weekday: "friday",
    labId: "LAB14",
    equipmentIds: ["CTM-C8821", "LOAD-C2101"],
    startTime: "09:00",
    endTime: "11:00",
  },

  // 29 June 2026 - Monday
  {
    id: "tt-2026-06-29-chemical-lab15",
    title: "Chemical Reaction Engineering Lab",
    date: "2026-06-29",
    weekday: "monday",
    labId: "LAB15",
    equipmentIds: ["REACT-C9021", "PH-C4432"],
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    id: "tt-2026-06-29-process-lab15",
    title: "Process Control Practical",
    date: "2026-06-29",
    weekday: "monday",
    labId: "LAB15",
    equipmentIds: ["REACT-C9021", "CTRL-R7731"],
    startTime: "10:00",
    endTime: "12:00",
  },
  {
    id: "tt-2026-06-29-environment-lab16",
    title: "Environmental Engineering Lab",
    date: "2026-06-29",
    weekday: "monday",
    labId: "LAB16",
    equipmentIds: ["WQ-E1101", "PH-C4432"],
    startTime: "11:00",
    endTime: "13:00",
  },

  // 30 June 2026 - Tuesday
  {
    id: "tt-2026-06-30-iot-lab17",
    title: "IoT Systems Lab",
    date: "2026-06-30",
    weekday: "tuesday",
    labId: "LAB17",
    equipmentIds: ["IOT-S3301", "SNS-R3302"],
    startTime: "13:00",
    endTime: "15:00",
  },
  {
    id: "tt-2026-06-30-embedded-lab18",
    title: "Embedded Systems Practical",
    date: "2026-06-30",
    weekday: "tuesday",
    labId: "LAB18",
    equipmentIds: ["MCU-E7762", "OSC-E3421"],
    startTime: "13:30",
    endTime: "15:30",
  },
  {
    id: "tt-2026-06-30-cloud-lab19",
    title: "Cloud Computing Lab",
    date: "2026-06-30",
    weekday: "tuesday",
    labId: "LAB19",
    equipmentIds: ["SRV-N2201", "FC-B4392"],
    startTime: "14:00",
    endTime: "16:00",
  },
];
function normalizeId(id) {
  return String(id || "")
    .trim()
    .toLowerCase();
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
  return getTimetableEventsForDate(dateInput).filter((event) =>
    matchesResourceId(event.labId, labId),
  );
}

export function getEquipmentTimetableEvents(equipmentId, dateInput) {
  return getTimetableEventsForDate(dateInput).filter((event) =>
    (event.equipmentIds || []).some((linkedEquipmentId) =>
      matchesResourceId(linkedEquipmentId, equipmentId),
    ),
  );
}

export function findLabTimetableConflict({ labId, date, startTime, endTime }) {
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
