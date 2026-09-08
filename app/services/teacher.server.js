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
  return prisma.teacher.findUnique({
    where: {
      id,
    },

    include: {
      genres: true,

      availability: {
        orderBy: [
          { day: "asc" },
          { timeSlot: "asc" },
        ],
      },
    },
  });
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