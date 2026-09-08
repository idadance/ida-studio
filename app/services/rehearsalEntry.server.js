import prisma from "../db.server";

export async function getRehearsalEntries() {
  return prisma.rehearsalEntry.findMany({
    include: {
      teacher: true,
      genre: true,
    },

    orderBy: [
      { studentLastName: "asc" },
      { studentFirstName: "asc" },
    ],
  });
}

export async function createRehearsalEntry(data) {
  return prisma.rehearsalEntry.create({
    data,
  });
}

export async function getRehearsalEntryCount() {
  return prisma.rehearsalEntry.count();
}