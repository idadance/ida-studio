import {
  getRegistrationById,
} from "./registration.server.js";

import {
  getTeacherAvailability,
  parseTeacherAvailabilitySlot,
} from "./teacher.server.js";

import {
  getAvailableStudiosAtLocation,
} from "./calendar.server.js";

import prisma from "../db.server";

export async function getRehearsalCandidateSlots(
  registrationId,
) {
  const registration =
    await getRegistrationById(
      registrationId,
    );

  if (!registration) {
    throw new Error(
      "Registration was not found.",
    );
  }

  if (
    registration.status !== "APPROVED"
  ) {
    throw new Error(
      "Registration must be approved before scheduling.",
    );
  }

  if (!registration.teacher) {
    throw new Error(
      "Registration does not have an assigned teacher.",
    );
  }

  if (
    !registration.availability?.length
  ) {
    return [];
  }

  const teacherAvailability =
    await getTeacherAvailability(
      registration.teacher.id,
      "2026-09-01T00:00:00Z",
      "2027-08-31T23:59:59Z",
    );

  const teacherSlots =
    teacherAvailability
      .map((slot) =>
        parseTeacherAvailabilitySlot(
          slot,
        ),
      )
      .filter(Boolean);

  const matchingSlots =
    registration.availability.flatMap(
      (parentSlot) => {
        return teacherSlots
          .filter(
            (teacherSlot) =>
              teacherSlot.date ===
                parentSlot.date &&
              teacherSlot.timeSlot ===
                parentSlot.timeSlot &&
              teacherSlot.preferredLocation ===
                parentSlot.preferredLocation,
          )
          .map((teacherSlot) => ({
            date: parentSlot.date,
            day: parentSlot.day,
            timeSlot:
              parentSlot.timeSlot,
            location:
              parentSlot.preferredLocation,
            start: teacherSlot.start,
            end: teacherSlot.end,
          }));
      },
    );

    const candidateSlots =
    await Promise.all(
      matchingSlots.map(
        async (slot) => {
          const teacherConflict =
            await checkTeacherSchedulingConflict(
              registration.teacher.id,
              slot.start,
              slot.end,
              slot.location,
            );

          if (!teacherConflict.available) {
            return null;
          }

          const studios =
            await getAvailableStudiosAtLocation(
              slot.location,
              slot.start.toISOString(),
              slot.end.toISOString(),
            );

          const availableStudios =
            studios
              .filter(
                (studio) =>
                  studio.available,
              )
              .map(
                (studio) =>
                  studio.calendar,
              );

          if (
            availableStudios.length === 0
          ) {
            return null;
          }

          return {
            date: slot.date,
            day: slot.day,
            timeSlot: slot.timeSlot,
            location: slot.location,
            start: slot.start,
            end: slot.end,
            availableStudios,
          };
        },
      ),
    );

  return candidateSlots.filter(Boolean);
}

export async function getTeacherScheduledRehearsals(
  teacherId,
  rangeStart,
  rangeEnd,
) {
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);

  return prisma.soloDuetScheduledRehearsal.findMany({
    where: {
      teacherId,

      startTime: {
        lt: end,
      },

      endTime: {
        gt: start,
      },
    },

    include: {
      registration: true,
    },

    orderBy: {
      startTime: "asc",
    },
  });
}

export async function checkTeacherSchedulingConflict(
  teacherId,
  proposedStart,
  proposedEnd,
  proposedLocation,
) {
  const start = new Date(proposedStart);
  const end = new Date(proposedEnd);

  const normalizedLocation =
    proposedLocation
      ?.trim()
      .toUpperCase();

  if (
    normalizedLocation !== "FW" &&
    normalizedLocation !== "PM"
  ) {
    throw new Error(
      `Unknown rehearsal location: ${proposedLocation}`,
    );
  }

  const bufferStart =
    new Date(
      start.getTime() -
        30 * 60 * 1000,
    );

  const bufferEnd =
    new Date(
      end.getTime() +
        30 * 60 * 1000,
    );

  const nearbyRehearsals =
    await prisma.soloDuetScheduledRehearsal.findMany({
      where: {
        teacherId,

        startTime: {
          lt: bufferEnd,
        },

        endTime: {
          gt: bufferStart,
        },
      },

      orderBy: {
        startTime: "asc",
      },
    });

  for (const rehearsal of nearbyRehearsals) {
    // A teacher can never have two
    // rehearsals happening at the same time.
    const overlaps =
      rehearsal.startTime < end &&
      rehearsal.endTime > start;

    if (overlaps) {
      return {
        available: false,
        reason: "OVERLAP",
        conflict: rehearsal,
      };
    }

    // Back-to-back rehearsals at the
    // same location are allowed.
    if (
      rehearsal.location ===
      normalizedLocation
    ) {
      continue;
    }

    // Switching FW <-> PM requires
    // at least 30 minutes of travel time.
    const beforeProposed =
      rehearsal.endTime <= start;

    if (beforeProposed) {
      const gap =
        start.getTime() -
        rehearsal.endTime.getTime();

      if (gap < 30 * 60 * 1000) {
        return {
          available: false,
          reason: "TRAVEL_BUFFER",
          conflict: rehearsal,
        };
      }

      continue;
    }

    const afterProposed =
      rehearsal.startTime >= end;

    if (afterProposed) {
      const gap =
        rehearsal.startTime.getTime() -
        end.getTime();

      if (gap < 30 * 60 * 1000) {
        return {
          available: false,
          reason: "TRAVEL_BUFFER",
          conflict: rehearsal,
        };
      }
    }
  }

  return {
    available: true,
    reason: null,
    conflict: null,
  };
}