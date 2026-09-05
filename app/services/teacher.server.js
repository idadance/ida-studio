import prisma from "../db.server";

export async function getTeachers() {
  return prisma.teacher.findMany({
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
  });
}

export async function createTeacher(data) {
  return prisma.teacher.create({
    data,
  });
}

export async function updateTeacher(id, data) {
  return prisma.teacher.update({
    where: {
      id,
    },
    data,
  });
}

export async function deleteTeacher(id) {
  return prisma.teacher.delete({
    where: {
      id,
    },
  });
}