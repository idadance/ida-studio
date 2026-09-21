import prisma from "../db.server";

export async function getRegistrations() {
  return prisma.soloDuetRegistration.findMany({
    include: {
  teacher: true,
  genre: true,
  availability: true,
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

export async function approveRegistration(id) {
  return prisma.soloDuetRegistration.update({
    where: {
      id,
    },

    data: {
      status: "APPROVED",
    },
  });
}

export async function getRegistrationById(
  id,
) {
  return prisma.soloDuetRegistration.findUnique({
    where: {
      id,
    },

    include: {
      teacher: true,
      genre: true,
      availability: true,
    },
  });
}