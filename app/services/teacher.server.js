import prisma from "../db.server";

export async function getTeachers() {
  return prisma.teacher.findMany({
    include: {
      genres: true,
      availability: true,
    },

    orderBy: [
      { firstName: "asc" },
      { lastName: "asc" },
    ],
  });
}

export async function getTeacher(id) {
  const teacher = await prisma.teacher.findUnique({
    where: {
      id,
    },

    include: {
      genres: true,

      availability: {
        orderBy: [
          { sortDate: "asc" },
          { timeSlot: "asc" },
        ],
      },
    },
  });

  console.log(
    teacher.availability.map((slot) => ({
      date: slot.date,
      sortDate: slot.sortDate,
    })),
  );

  return teacher;
}

export async function createTeacher(data) {
  return prisma.teacher.create({
    data,
  });
}

export async function updateTeacher(id, data) {
  const { genres, ...teacherData } = data;

  return prisma.teacher.update({
    where: {
      id,
    },

    data: {
      ...teacherData,

      genres: {
        set: genres.map((genreId) => ({
          id: genreId,
        })),
      },
    },
  });
}

export async function deleteTeacher(id) {
  return prisma.teacher.delete({
    where: {
      id,
    },
  });
}

export async function getTeacherCount() {
  return prisma.teacher.count();
}

export async function getTeacherByName(
  firstName,
) {
  return prisma.teacher.findFirst({
    where: {
      firstName,
      active: true,
    },
  });
}

export async function getTeacherAvailability(
  teacherId,
  rangeStart,
  rangeEnd,
) {
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);

  return prisma.teacherAvailability.findMany({
    where: {
      teacherId,

      sortDate: {
        gte: start,
        lte: end,
      },
    },

    orderBy: [
      { sortDate: "asc" },
      { timeSlot: "asc" },
    ],
  });
}

function getNewYorkOffset(dateString) {
  const referenceDate = new Date(
    `${dateString}T12:00:00Z`,
  );

  const formatter =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "longOffset",
    });

  const offsetPart =
    formatter
      .formatToParts(referenceDate)
      .find(
        (part) =>
          part.type === "timeZoneName",
      );

  if (!offsetPart) {
    throw new Error(
      `Could not determine New York timezone offset for ${dateString}`,
    );
  }

  return offsetPart.value.replace(
    "GMT",
    "",
  );
}

export function parseTeacherAvailabilitySlot(
  availability,
) {
  if (
    !availability?.sortDate ||
    !availability?.timeSlot
  ) {
    return null;
  }

  const match =
    availability.timeSlot
      .trim()
      .match(
        /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i,
      );

  if (!match) {
    return null;
  }

  const [
    ,
    startHourText,
    startMinuteText = "00",
    startMeridiemText,
    endHourText,
    endMinuteText = "00",
    endMeridiemText,
  ] = match;

  const endMeridiem =
    endMeridiemText.toLowerCase();

  const startMeridiem =
    startMeridiemText?.toLowerCase() ??
    endMeridiem;

  function to24Hour(
    hourText,
    meridiem,
  ) {
    let hour = Number(hourText);

    if (meridiem === "am") {
      if (hour === 12) {
        hour = 0;
      }
    } else if (
      meridiem === "pm" &&
      hour !== 12
    ) {
      hour += 12;
    }

    return hour;
  }

  const startHour = to24Hour(
    startHourText,
    startMeridiem,
  );

  const endHour = to24Hour(
    endHourText,
    endMeridiem,
  );

  const date =
    availability.sortDate
      .toISOString()
      .slice(0, 10);

      const offset =
  getNewYorkOffset(date);

  const start = new Date(
    `${date}T${String(startHour).padStart(
      2,
      "0",
    )}:${startMinuteText}:00${offset}`,
  );

  const end = new Date(
    `${date}T${String(endHour).padStart(
      2,
      "0",
    )}:${endMinuteText}:00${offset}`,
  );

  return {
    ...availability,
    start,
    end,
  };
}