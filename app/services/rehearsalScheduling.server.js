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