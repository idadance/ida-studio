import prisma from "../db.server";

export async function getRehearsalDates(seasonId) {
  return prisma.rehearsalDate.findMany({
    where: {
      seasonId,
    },

    orderBy: {
      date: "asc",
    },
  });
}

export async function createRehearsalDate(data) {
  return prisma.rehearsalDate.create({
    data,
  });
}

export async function deleteRehearsalDate(id) {
  return prisma.rehearsalDate.delete({
    where: {
      id,
    },
  });
}