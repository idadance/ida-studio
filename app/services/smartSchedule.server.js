import prisma from "../db.server.js";

import {
  checkTeacherSchedulingConflict,
} from "./rehearsalScheduling.server.js";

import {
  parseTeacherAvailabilitySlot,
} from "./teacher.server.js";

import {
  getAvailableStudiosAtLocation,
} from "./calendar.server.js";

import {
  buildSmartScheduleRecommendations as buildTestedSmartScheduleRecommendations,
} from "./smartScheduleLogic.js";

export async function getSmartScheduleTeacherData(
  teacherId,
) {
  const teacher = await prisma.teacher.findUnique({
    where: {
      id: teacherId,
    },
  });

  if (!teacher) {
    throw new Error("Teacher was not found.");
  }

  const registrations =
    await prisma.soloDuetRegistration.findMany({
      where: {
        teacherId,
        status: "APPROVED",
        OR: [
          { paymentMethod: "CHECK" },
          { paymentStatus: "PAID" },
        ],
      },

      include: {
        availability: true,

        scheduledRehearsals: {
          orderBy: {
            startTime: "asc",
          },
        },
      },

      orderBy: [
        { studentLastName: "asc" },
        { studentFirstName: "asc" },
      ],
    });

  const teacherAvailability =
    await prisma.teacherAvailability.findMany({
      where: {
        teacherId,
      },
      orderBy: {
        sortDate: "asc",
      },
    });

  return {
    teacher,
    registrations,
    teacherAvailability,
  };
}

export function groupSmartScheduleRegistrations(
  registrations,
) {
  const groups = [];
  const processedIds = new Set();

  for (const registration of registrations) {
    if (processedIds.has(registration.id)) {
      continue;
    }

    if (registration.entryType !== "DUET") {
      groups.push({
        type: "SOLO",
        registrationIds: [registration.id],
        dancers: [registration],
        schedulingIssue: null,
      });

      processedIds.add(registration.id);
      continue;
    }

    const matches = registrations.filter(
      (candidate) =>
        candidate.id !== registration.id &&
        candidate.entryType === "DUET" &&
        candidate.teacherId === registration.teacherId &&
        candidate.studentFirstName.trim().toLowerCase() ===
          registration.partnerFirstName?.trim().toLowerCase() &&
        candidate.studentLastName.trim().toLowerCase() ===
          registration.partnerLastName?.trim().toLowerCase() &&
        candidate.partnerFirstName?.trim().toLowerCase() ===
          registration.studentFirstName.trim().toLowerCase() &&
        candidate.partnerLastName?.trim().toLowerCase() ===
          registration.studentLastName.trim().toLowerCase(),
    );

    if (matches.length !== 1) {
      groups.push({
        type: "DUET",
        registrationIds: [registration.id],
        dancers: [registration],
        schedulingIssue:
          matches.length === 0
            ? "Duet partner could not be matched."
            : "Multiple possible duet partners found.",
      });

      processedIds.add(registration.id);
      continue;
    }

    const partner = matches[0];

    groups.push({
      type: "DUET",
      registrationIds: [
        registration.id,
        partner.id,
      ],
      dancers: [registration, partner],
      schedulingIssue: null,
    });

    processedIds.add(registration.id);
    processedIds.add(partner.id);
  }

  return groups;
}

export function countSmartScheduleRehearsals(group) {
  const appointments = new Map();

  for (const dancer of group.dancers) {
    for (const rehearsal of dancer.scheduledRehearsals ?? []) {
      const key = [
        rehearsal.teacherId,
        rehearsal.startTime.toISOString(),
        rehearsal.endTime.toISOString(),
        rehearsal.studioCalendar,
      ].join("|");

      if (!appointments.has(key)) {
        appointments.set(key, {
          startTime: rehearsal.startTime,
          endTime: rehearsal.endTime,
          location: rehearsal.location,
          studioCalendar: rehearsal.studioCalendar,
          rehearsalIds: [],
        });
      }

      appointments.get(key).rehearsalIds.push(rehearsal.id);
    }
  }

  const scheduledAppointments = [...appointments.values()];

  return {
    ...group,
    scheduledAppointments,
    scheduledCount: scheduledAppointments.length,
    remainingCount: Math.max(0, 3 - scheduledAppointments.length),
    schedulingIssue:
      group.schedulingIssue ??
      (scheduledAppointments.length > 3
        ? "More than three rehearsals are scheduled."
        : null),
  };
}

function parseSmartScheduleParentSlot(availability) {
  if (!availability?.date || !availability?.timeSlot) {
    return null;
  }

  const year =
    availability.date.includes("January") ||
    availability.date.includes("February")
      ? 2027
      : 2026;

  const cleanedDate = availability.date.replace(
    /(\d+)(st|nd|rd|th)/,
    "$1",
  );

  const parsedDate = new Date(`${cleanedDate}, ${year}`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const sortDate = new Date(
    Date.UTC(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate(),
    ),
  );

  return parseTeacherAvailabilitySlot({
    ...availability,
    sortDate,
  });
}

function getSmartScheduleSlotKey(slot) {
  if (!slot?.start || !slot?.end) {
    return null;
  }

  const start = new Date(slot.start);
  const end = new Date(slot.end);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return null;
  }

  return `${start.toISOString()}|${end.toISOString()}`;
}

export function getSmartScheduleMatchingSlots(
  group,
  teacherAvailability,
) {
  if (group.schedulingIssue || !group.dancers?.length) {
    return [];
  }

  const teacherSlots = teacherAvailability
    .map(parseTeacherAvailabilitySlot)
    .filter(Boolean);

  const dancerSlotMaps = group.dancers.map((dancer) => {
    const slots = (dancer.availability ?? [])
      .map(parseSmartScheduleParentSlot)
      .filter(Boolean);

    return new Map(
      slots
        .map((slot) => [getSmartScheduleSlotKey(slot), slot])
        .filter(([key]) => key !== null),
    );
  });

  const matches = [];
  const seen = new Set();

  for (const teacherSlot of teacherSlots) {
    const key = getSmartScheduleSlotKey(teacherSlot);

    if (!key || seen.has(key)) {
      continue;
    }

    const dancerSlots = dancerSlotMaps.map(
      (slotMap) => slotMap.get(key),
    );

    if (dancerSlots.some((slot) => !slot)) {
      continue;
    }

    seen.add(key);

            const match = {
      teacherId: group.dancers[0].teacherId,
      start: teacherSlot.start,
      end: teacherSlot.end,
      teacherLocation: teacherSlot.preferredLocation,
      dancerLocations: dancerSlots.map(
        (slot) => slot.preferredLocation,
      ),
    };

    const allowedLocations =
      getSmartScheduleAllowedLocations(match);

    if (allowedLocations.length === 0) {
      continue;
    }

    matches.push({
      ...match,
      allowedLocations,
    });
  }

  return matches;
}

function getSmartScheduleAllowedLocations(match) {
  const locations = ["FW", "PM"];

  function normalizeLocation(value) {
    const text = String(value ?? "").trim().toLowerCase();

    if (
      text === "fw" ||
      text === "fort washington"
    ) {
      return ["FW"];
    }

    if (
      text === "pm" ||
      text === "plymouth meeting"
    ) {
      return ["PM"];
    }

    if (text === "either" || text === "both") {
      return locations;
    }

    return [];
  }

  const preferences = [
    match.teacherLocation,
    ...match.dancerLocations,
  ];

  return locations.filter((location) =>
    preferences.every((preference) =>
      normalizeLocation(preference).includes(location),
    ),
  );
}

export async function getSmartScheduleAvailableRooms(match) {
  const availableRooms = [];

  for (const location of match.allowedLocations ?? []) {
    const studios = await getAvailableStudiosAtLocation(
      location,
      match.start,
      match.end,
    );

        const teacherConflict =
      await checkTeacherSchedulingConflict(
        match.teacherId,
        match.start,
        match.end,
        location,
      );

    if (!teacherConflict.available) {
      continue;
    }

    for (const studio of studios) {
      if (studio.available) {
        availableRooms.push({
          location,
          studioCalendar: studio.calendar,
          start: match.start,
          end: match.end,
        });
      }
    }
  }

  return availableRooms;
}

export async function getSmartSchedulePreview(teacherId) {
  const data = await getSmartScheduleTeacherData(teacherId);

  const groups = groupSmartScheduleRegistrations(
    data.registrations,
  );

  const results = [];

  for (const group of groups) {
    const countedGroup =
      countSmartScheduleRehearsals(group);

    const matchingSlots =
      getSmartScheduleMatchingSlots(
        countedGroup,
        data.teacherAvailability,
      );

    const availableRooms = [];

    if (
      !countedGroup.schedulingIssue &&
      countedGroup.remainingCount > 0
    ) {
            for (const match of matchingSlots) {
        const alreadyScheduled =
          countedGroup.scheduledAppointments.some(
            (appointment) =>
              appointment.startTime.getTime() ===
                match.start.getTime() &&
              appointment.endTime.getTime() ===
                match.end.getTime(),
          );

        if (alreadyScheduled) {
          continue;
        }

        const rooms =
          await getSmartScheduleAvailableRooms(match);

                for (const room of rooms) {
          const duplicate = availableRooms.some(
            (existing) =>
              existing.start.getTime() ===
                room.start.getTime() &&
              existing.end.getTime() ===
                room.end.getTime() &&
              existing.studioCalendar ===
                room.studioCalendar,
          );

          if (!duplicate) {
            availableRooms.push(room);
          }
        }
      }
    }

        const usableTimeCount = new Set(
      availableRooms.map(
        (room) =>
          `${room.start.toISOString()}|${room.end.toISOString()}`,
      ),
    ).size;

    results.push({
      ...countedGroup,
      matchingSlotCount: matchingSlots.length,
      usableTimeCount,
      availableRooms,
    });
  }

    const timeCompetition =
    getSmartScheduleTimeCompetition(results);

  for (const group of results) {
    group.availableRooms = group.availableRooms.map(
      (room) => {
        const key =
          `${room.start.toISOString()}|${room.end.toISOString()}`;

        return {
          ...room,
          competingGroupCount:
            timeCompetition.get(key) ?? 0,
        };
      },
    );
  }

    results.sort((a, b) => {
    // Groups needing no more rehearsals go last.
    if (a.remainingCount === 0 && b.remainingCount > 0) {
      return 1;
    }

    if (b.remainingCount === 0 && a.remainingCount > 0) {
      return -1;
    }

    // Groups with scheduling issues need review first.
    if (a.schedulingIssue && !b.schedulingIssue) {
      return -1;
    }

    if (b.schedulingIssue && !a.schedulingIssue) {
      return 1;
    }

    // Prioritize fewer available time slots.
        return a.usableTimeCount - b.usableTimeCount;
  });

    const recommendations =
    buildSmartScheduleRecommendations(results);

  return {
    teacher: data.teacher,
    groups: recommendations,
  };
}

function getSmartScheduleTimeCompetition(groups) {
  const timeCounts = new Map();

  for (const group of groups) {
    if (group.schedulingIssue || group.remainingCount === 0) {
      continue;
    }

    const groupTimes = new Set(
      group.availableRooms.map(
        (room) =>
          `${room.start.toISOString()}|${room.end.toISOString()}`,
      ),
    );

    for (const key of groupTimes) {
      timeCounts.set(key, (timeCounts.get(key) ?? 0) + 1);
    }
  }

  return timeCounts;
}

export function buildSmartScheduleRecommendations(groups) {
  return buildTestedSmartScheduleRecommendations(groups);
}