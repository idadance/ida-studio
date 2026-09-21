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