import {
  getRegistrationById,
} from "./registration.server.js";

import {
  getTeacherAvailability,
  parseTeacherAvailabilitySlot,
} from "./teacher.server.js";

import {
  createStudioCalendarEvent,
  deleteStudioCalendarEvent,
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

          const unresolvedCancellations =
  await prisma.soloDuetScheduledRehearsal.findMany({
    where: {
      studioCalendar: {
        in: studios.map((studio) => studio.calendar),
      },
      cancellationStatus: {
        in: ["CANCEL_PENDING", "CANCEL_REVIEW"],
      },
      startTime: {
        lt: slot.end,
      },
      endTime: {
        gt: slot.start,
      },
    },
    select: {
      studioCalendar: true,
    },
  });

const blockedStudios = new Set(
  unresolvedCancellations.map(
    (rehearsal) => rehearsal.studioCalendar
  )
);

const availableStudios = studios
  .filter(
    (studio) =>
      studio.available &&
      !blockedStudios.has(studio.calendar)
  )
  .map((studio) => studio.calendar);

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

  const now = new Date();

return candidateSlots.filter(
  (slot) =>
    slot !== null &&
    slot.start > now
);
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

  cancellationStatus: {
    not: "CANCELED",
  },

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
  excludeRehearsalIds = [],
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
        cancellationStatus: {
  in: ["ACTIVE", "CANCEL_PENDING", "CANCEL_REVIEW"],
},

  ...(excludeRehearsalIds.length > 0
    ? {
        id: {
          notIn: excludeRehearsalIds,
        },
      }
    : {}),

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

  const unresolvedStudioCancellation =
  await prisma.soloDuetScheduledRehearsal.findFirst({
    where: {
      studioCalendar,
      cancellationStatus: {
        in: ["CANCEL_PENDING", "CANCEL_REVIEW"],
      },
      startTime: {
        lt: end,
      },
      endTime: {
        gt: start,
      },
    },
  });

if (unresolvedStudioCancellation) {
  throw new Error(
    "This studio has a rehearsal cancellation awaiting confirmation or review at the requested time. Please resolve it before scheduling another rehearsal."
  );
}

  const existingCount =
  await prisma.soloDuetScheduledRehearsal.count({
    where: {
      registrationId,
      cancellationStatus: {
        in: ["ACTIVE", "CANCEL_PENDING", "CANCEL_REVIEW"],
      },
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
      registrationId: duetPartner.id,
      cancellationStatus: {
        in: ["ACTIVE", "CANCEL_PENDING", "CANCEL_REVIEW"],
      },
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

const calendarEvent = await createStudioCalendarEvent({
  calendarName:
    studioCalendar,

  title:
    `${registration.teacher.firstName}-${dancerNames}`,

  startTime: start,
  endTime: end,
});

  
let rehearsal;

try {
  rehearsal = await prisma.$transaction(async (tx) => {
    const rehearsalData = {
      teacherId: registration.teacher.id,
      startTime: start,
      endTime: end,
      location: location.trim().toUpperCase(),
      studioCalendar,
      appleCalendarUid: calendarEvent.uid,
      appleCalendarUrl: calendarEvent.url,
    };

    const savedRehearsal =
      await tx.soloDuetScheduledRehearsal.create({
        data: {
          ...rehearsalData,
          registrationId,
        },
      });

    if (duetPartner) {
      await tx.soloDuetScheduledRehearsal.create({
        data: {
          ...rehearsalData,
          registrationId: duetPartner.id,
        },
      });
    }

    return savedRehearsal;
  });
} catch (databaseError) {
  console.error(
    "Rehearsal database save failed:",
    databaseError,
  );

  try {
    await deleteStudioCalendarEvent({
      url: calendarEvent.url,
      uid: calendarEvent.uid,
    });
  } catch (cleanupError) {
    console.error(
      "CRITICAL: Rehearsal calendar cleanup failed:",
      {
        calendarUrl: calendarEvent.url,
        calendarUid: calendarEvent.uid,
        cleanupError,
      },
    );

    throw new Error(
      "The rehearsal could not be saved, and its Apple Calendar event could not be removed. Please contact the administrator before trying again.",
    );
  }

  throw new Error(
    "The rehearsal could not be saved. The newly created Apple Calendar event was removed. Please try again.",
  );
}

return rehearsal;

}

export async function cancelScheduledRehearsal({
  registrationId,
  rehearsalId,
}) {
  const rehearsal =
    await prisma.soloDuetScheduledRehearsal.findFirst({
      where: {
        id: rehearsalId,
        registrationId,
        cancellationStatus: "ACTIVE",
      },
    });

  if (!rehearsal) {
    throw new Error(
      "This rehearsal was not found or is already canceled."
    );
  }

  if (
    !rehearsal.appleCalendarUid ||
    !rehearsal.appleCalendarUrl
  ) {
    throw new Error(
      "Apple Calendar identifiers are missing. Please review this rehearsal manually."
    );
  }

  const linkedRehearsals =
    await prisma.soloDuetScheduledRehearsal.findMany({
      where: {
        appleCalendarUid: rehearsal.appleCalendarUid,
        appleCalendarUrl: rehearsal.appleCalendarUrl,
      },
    });

  const validGroup =
    linkedRehearsals.length >= 1 &&
    linkedRehearsals.length <= 2 &&
    linkedRehearsals.every(
      (item) =>
        item.cancellationStatus === "ACTIVE" &&
        item.teacherId === rehearsal.teacherId &&
        item.startTime.getTime() ===
          rehearsal.startTime.getTime() &&
        item.endTime.getTime() ===
          rehearsal.endTime.getTime() &&
        item.studioCalendar ===
          rehearsal.studioCalendar
    );

  if (!validGroup) {
    throw new Error(
      "The linked rehearsal records need manual review before cancellation."
    );
  }

  const rehearsalIds = linkedRehearsals.map(
    (item) => item.id
  );

  // Preserve records before contacting Apple Calendar.
  await prisma.$transaction(async (tx) => {
  const pendingUpdate =
    await tx.soloDuetScheduledRehearsal.updateMany({
      where: {
        id: { in: rehearsalIds },
        cancellationStatus: "ACTIVE",
      },
      data: {
        cancellationStatus: "CANCEL_PENDING",
      },
    });

  if (pendingUpdate.count !== rehearsalIds.length) {
    throw new Error(
      "The rehearsal cancellation could not be started safely. No Apple Calendar event was deleted. Please refresh and try again."
    );
  }
});

  try {
    await deleteStudioCalendarEvent({
      url: rehearsal.appleCalendarUrl,
      uid: rehearsal.appleCalendarUid,
    });
  } catch (calendarError) {
    console.error(
      "Rehearsal cancellation needs review:",
      {
        rehearsalIds,
        calendarUrl: rehearsal.appleCalendarUrl,
        calendarUid: rehearsal.appleCalendarUid,
        calendarError,
      }
    );

    // Keep the records and calendar identifiers for recovery.
    await prisma.soloDuetScheduledRehearsal.updateMany({
      where: {
        id: { in: rehearsalIds },
      },
      data: {
        cancellationStatus: "CANCEL_REVIEW",
      },
    });

    throw new Error(
      "Apple Calendar could not confirm cancellation. The rehearsal has been flagged for review. Do not schedule another rehearsal in this studio until the issue is resolved."
    );
  }

  try {
  const completed =
    await prisma.soloDuetScheduledRehearsal.updateMany({
      where: {
        id: { in: rehearsalIds },
        cancellationStatus: "CANCEL_PENDING",
      },
      data: {
        cancellationStatus: "CANCELED",
      },
    });

  if (completed.count !== rehearsalIds.length) {
    throw new Error(
      "Not all linked rehearsal records were finalized."
    );
  }
} catch (databaseError) {
  console.error(
    "CRITICAL: Apple Calendar event deleted, but cancellation database update failed:",
    {
      rehearsalIds,
      calendarUrl: rehearsal.appleCalendarUrl,
      calendarUid: rehearsal.appleCalendarUid,
      databaseError,
    }
  );

  throw new Error(
    "Apple Calendar cancellation succeeded, but IDA Studio could not finalize the records. Do not retry cancellation or reschedule this rehearsal until an administrator reviews it."
  );
}

  return {
    success: true,
    canceledCount: rehearsalIds.length,
  };
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
      cancellationStatus: {
  not: "CANCELED",
},
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
  cancellationStatus: {
    not: "CANCELED",
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