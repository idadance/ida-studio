import {
  getRegistrationById,
} from "./registration.server.js";

import {
  getTeacherAvailability,
  parseTeacherAvailabilitySlot,
} from "./teacher.server.js";

import {
  createStudioCalendarEvent,
  getAvailableStudiosAtLocation,
} from "./calendar.server.js";

import prisma from "../db.server";

function parseParentAvailabilitySlot(
  availability,
) {
  if (
    !availability?.date ||
    !availability?.timeSlot
  ) {
    return null;
  }

  const year =
    availability.date.includes("January") ||
    availability.date.includes("February")
      ? 2027
      : 2026;

  const cleanedDate =
    availability.date.replace(
      /(\d+)(st|nd|rd|th)/,
      "$1",
    );

  const parsedDate = new Date(
    `${cleanedDate}, ${year}`,
  );

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

async function getDuetPartnerRegistration(
  registration,
) {
  if (
    registration.entryType !== "DUET" ||
    !registration.partnerFirstName ||
    !registration.partnerLastName
  ) {
    return null;
  }

  return prisma.soloDuetRegistration.findFirst({
    where: {
      entryType: "DUET",
      status: "APPROVED",

      studentFirstName: {
        equals:
          registration.partnerFirstName,
        mode: "insensitive",
      },

      studentLastName: {
        equals:
          registration.partnerLastName,
        mode: "insensitive",
      },

      partnerFirstName: {
        equals:
          registration.studentFirstName,
        mode: "insensitive",
      },

      partnerLastName: {
        equals:
          registration.studentLastName,
        mode: "insensitive",
      },
    },

    include: {
      teacher: true,
      genre: true,
      availability: true,

      scheduledRehearsals: {
        orderBy: {
          startTime: "asc",
        },
      },
    },
  });
}

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

  const duetPartner =
  await getDuetPartnerRegistration(
    registration,
  );

if (
  registration.entryType === "DUET" &&
  !duetPartner
) {
  return [];
}

const parentAvailability =
  registration.entryType === "DUET"
    ? registration.availability.filter(
        (slot) =>
          duetPartner.availability.some(
            (partnerSlot) => {
              const sameDate =
                partnerSlot.date ===
                slot.date;

              const sameTime =
                partnerSlot.timeSlot ===
                slot.timeSlot;

              const dancerLocation =
                slot.preferredLocation
                  ?.trim()
                  .toLowerCase();

              const partnerLocation =
                partnerSlot.preferredLocation
                  ?.trim()
                  .toLowerCase();

              const dancerAllowsFW =
                dancerLocation ===
                  "fort washington" ||
                dancerLocation ===
                  "fort washington or plymouth meeting";

              const dancerAllowsPM =
                dancerLocation ===
                  "plymouth meeting" ||
                dancerLocation ===
                  "fort washington or plymouth meeting";

              const partnerAllowsFW =
                partnerLocation ===
                  "fort washington" ||
                partnerLocation ===
                  "fort washington or plymouth meeting";

              const partnerAllowsPM =
                partnerLocation ===
                  "plymouth meeting" ||
                partnerLocation ===
                  "fort washington or plymouth meeting";

              const sharedLocation =
                (dancerAllowsFW &&
                  partnerAllowsFW) ||
                (dancerAllowsPM &&
                  partnerAllowsPM);

              return (
                sameDate &&
                sameTime &&
                sharedLocation
              );
            },
          ),
      )
    : registration.availability;

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

      console.log("SCHEDULING MATCH DEBUG", {
  registration:
    `${registration.studentFirstName} ${registration.studentLastName}`,
  teacher: registration.teacher.firstName,

  parentSlots:
    registration.availability.map(
      (slot) => ({
        date: slot.date,
        timeSlot: slot.timeSlot,
        preferredLocation:
          slot.preferredLocation,
      }),
    ),

  teacherSlots: teacherSlots.map(
    (slot) => ({
      date: slot.date,
      timeSlot: slot.timeSlot,
      preferredLocation:
        slot.preferredLocation,
    }),
  ),
});

  const matchingSlots =
  teacherSlots.length === 0
    ? parentAvailability
    .map((parentSlot) =>
          parseParentAvailabilitySlot(
            parentSlot,
          ),
        )
        .filter(Boolean)
        .flatMap((parentSlot) => {
          const preferredLocation =
            parentSlot.preferredLocation
              ?.trim()
              .toLowerCase();

          const locations =
            preferredLocation ===
            "fort washington or plymouth meeting"
              ? ["FW", "PM"]
              : preferredLocation ===
                  "fort washington"
                ? ["FW"]
                : preferredLocation ===
                    "plymouth meeting"
                  ? ["PM"]
                  : [];

          return locations.map(
            (location) => ({
              date: parentSlot.date,
              day: parentSlot.day,
              timeSlot:
                parentSlot.timeSlot,
              location,
              start: parentSlot.start,
              end: parentSlot.end,
            }),
          );
        })
    : parentAvailability.flatMap(
    (parentSlot) => {
          return teacherSlots
            .filter((teacherSlot) => {
  const parentLocation =
    parentSlot.preferredLocation
      ?.trim()
      .toLowerCase();

  const teacherLocation =
    teacherSlot.preferredLocation
      ?.trim()
      .toUpperCase();

  const locationMatches =
  parentLocation ===
    "fort washington or plymouth meeting" ||
  ((parentLocation ===
      "fort washington" ||
    parentLocation === "fw") &&
    teacherLocation === "FW") ||
  ((parentLocation ===
      "plymouth meeting" ||
    parentLocation === "pm") &&
    teacherLocation === "PM");

  return (
    teacherSlot.date ===
      parentSlot.date &&
    teacherSlot.timeSlot ===
      parentSlot.timeSlot &&
    locationMatches
  );
})
            .map((teacherSlot) => ({
              date: parentSlot.date,
              day: parentSlot.day,
              timeSlot:
                parentSlot.timeSlot,
              location:
  teacherSlot.preferredLocation,
              start: teacherSlot.start,
              end: teacherSlot.end,
            }));
        },
      );

      console.log(
  "MATCHING SLOTS DEBUG",
  matchingSlots.map((slot) => ({
    date: slot.date,
    timeSlot: slot.timeSlot,
    location: slot.location,
    start: slot.start,
    end: slot.end,
  })),
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

          console.log("CHECKING PARENT SLOT", {
  date: slot.date,
  timeSlot: slot.timeSlot,
  location: slot.location,
  start: slot.start,
  end: slot.end,
});

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

export async function createScheduledRehearsal({
  registrationId,
  startTime,
  endTime,
  location,
  studioCalendar,
}) {
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

  const start = new Date(startTime);
  const end = new Date(endTime);

  const duetPartner =
  await getDuetPartnerRegistration(
    registration,
  );

if (
  registration.entryType === "DUET" &&
  !duetPartner
) {
  throw new Error(
    "The matching duet partner registration could not be found.",
  );
}

  const teacherConflict =
    await checkTeacherSchedulingConflict(
      registration.teacher.id,
      start,
      end,
      location,
    );

  if (!teacherConflict.available) {
    throw new Error(
      "The teacher is no longer available for this rehearsal time.",
    );
  }

  const studios =
    await getAvailableStudiosAtLocation(
      location,
      start.toISOString(),
      end.toISOString(),
    );

  const selectedStudio =
    studios.find(
      (studio) =>
        studio.calendar ===
        studioCalendar,
    );

  if (
    !selectedStudio ||
    !selectedStudio.available
  ) {
    throw new Error(
      "That studio is no longer available for this rehearsal time.",
    );
  }

  const existingCount =
  await prisma.soloDuetScheduledRehearsal.count({
    where: {
      registrationId,
    },
  });

if (existingCount >= 3) {
  throw new Error(
    "This registration already has 3 scheduled rehearsals.",
  );
}

if (duetPartner) {
  const partnerExistingCount =
    await prisma.soloDuetScheduledRehearsal.count({
      where: {
        registrationId:
          duetPartner.id,
      },
    });

  if (partnerExistingCount >= 3) {
    throw new Error(
      "The duet partner already has 3 scheduled rehearsals for this duet.",
    );
  }
}

    const dancerNames =
  duetPartner
    ? `${registration.studentFirstName} ${registration.studentLastName} & ${duetPartner.studentFirstName} ${duetPartner.studentLastName}`
    : `${registration.studentFirstName} ${registration.studentLastName}`;

await createStudioCalendarEvent({
  calendarName:
    studioCalendar,

  title:
    `${registration.teacher.firstName}-${dancerNames}`,

  startTime: start,
  endTime: end,
});

  const rehearsal =
  await prisma.soloDuetScheduledRehearsal.create({
    data: {
      registrationId,

      teacherId:
        registration.teacher.id,

      startTime: start,
      endTime: end,

      location:
        location
          .trim()
          .toUpperCase(),

      studioCalendar,
    },
  });

if (duetPartner) {
  await prisma.soloDuetScheduledRehearsal.create({
    data: {
      registrationId:
        duetPartner.id,

      teacherId:
        registration.teacher.id,

      startTime: start,
      endTime: end,

      location:
        location
          .trim()
          .toUpperCase(),

      studioCalendar,
    },
  });
}

return rehearsal;
}

export async function getRelatedDancerRehearsals(
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

  return prisma.soloDuetScheduledRehearsal.findMany({
    where: {
      registration: {
        studentFirstName:
          registration.studentFirstName,

        studentLastName:
          registration.studentLastName,

        id: {
          not: registration.id,
        },
      },
    },

    include: {
      registration: {
        include: {
          teacher: true,
          genre: true,
        },
      },

      teacher: true,
    },

    orderBy: {
      startTime: "asc",
    },
  });
}

export async function getCoordinatingDancerRehearsals(
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

  const coordinatingName =
    registration.coordinatingDancerName?.trim();

  if (!coordinatingName) {
    return [];
  }

  const registrations =
    await prisma.soloDuetRegistration.findMany({
      where: {
        id: {
          not: registration.id,
        },
      },

      select: {
        id: true,
        studentFirstName: true,
        studentLastName: true,
      },
    });

  const normalizedName =
    coordinatingName
      .replace(/\s+/g, " ")
      .toLowerCase();

  const matchingRegistrationIds =
    registrations
      .filter((item) => {
        const dancerName =
          `${item.studentFirstName} ${item.studentLastName}`
            .trim()
            .replace(/\s+/g, " ")
            .toLowerCase();

        return dancerName === normalizedName;
      })
      .map((item) => item.id);

  if (
    matchingRegistrationIds.length === 0
  ) {
    return [];
  }

  return prisma.soloDuetScheduledRehearsal.findMany({
    where: {
      registrationId: {
        in: matchingRegistrationIds,
      },
    },

    include: {
      registration: {
        include: {
          teacher: true,
          genre: true,
        },
      },

      teacher: true,
    },

    orderBy: {
      startTime: "asc",
    },
  });
}