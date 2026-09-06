import prisma from "../db.server";

export async function getSeasons() {
  return prisma.season.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getSeason(id) {
  return prisma.season.findUnique({
    where: {
      id,
    },
  });
}

export async function createSeason(data) {
  return prisma.season.create({
    data,
  });
}

export async function updateSeason(id, data) {
  return prisma.season.update({
    where: {
      id,
    },
    data,
  });
}