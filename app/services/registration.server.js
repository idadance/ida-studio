import prisma from "../db.server";

export async function getRegistrations() {
  return prisma.soloDuetRegistration.findMany({
    where: {
      OR: [
        {
          paymentMethod: "CHECK",
        },
        {
          paymentStatus: "PAID",
        },
      ],
    },

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

export async function assignRegistrationTeacher(
  id,
  teacherId,
) {
  const teacher = await prisma.teacher.findFirst({
    where: {
      id: teacherId,
      active: true,
    },
  });

  if (!teacher) {
    throw new Error(
      "Selected teacher was not found.",
    );
  }

  return prisma.soloDuetRegistration.update({
    where: {
      id,
    },

    data: {
      teacherId: teacher.id,
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

  scheduledRehearsals: {
    orderBy: {
      startTime: "asc",
    },
  },
},
  });
}