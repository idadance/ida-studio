import prisma from "../db.server";

export async function getRegistrations() {
  return prisma.soloDuetRegistration.findMany({
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

export async function createRegistration(data) {
  return prisma.soloDuetRegistration.create({
    data,
  });
}

export async function getRegistrationCount() {
  return prisma.soloDuetRegistration.count();
}