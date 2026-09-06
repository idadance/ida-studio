import prisma from "../db.server";

export async function getGenres() {
  return prisma.genre.findMany({
    orderBy: {
      name: "asc",
    },
  });
}

export async function getGenre(id) {
  return prisma.genre.findUnique({
    where: { id },
  });
}

export async function createGenre(data) {
  return prisma.genre.create({
    data,
  });
}

export async function updateGenre(id, data) {
  return prisma.genre.update({
    where: { id },
    data,
  });
}