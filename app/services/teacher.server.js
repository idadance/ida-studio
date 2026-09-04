import prisma from "../db.server";

export async function getTeachers() {
  return prisma.teacher.findMany({
    orderBy: [
      {
        firstName: "asc",
      },
      {
        lastName: "asc",
      },
    ],
  });
}