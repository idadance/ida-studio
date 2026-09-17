import prisma from "../db.server";

export async function importTeacherAvailability(
  teacherId,
  availability,
) {
  // Remove the teacher's old availability
  await prisma.teacherAvailability.deleteMany({
    where: {
      teacherId,
    },
  });

  console.log(
  "Importing",
  availability.length,
  "slots into database",
);

  // Import the latest availability
  await prisma.teacherAvailability.createMany({
    data: availability.map((slot) => ({
  teacherId,

  day: slot.day,
  date: slot.date,

  sortDate: new Date(slot.sortDate),

  timeSlot: slot.timeSlot,

  preferredLocation:
    slot.preferredLocation,

  notes: slot.notes,
})),
  });

  await prisma.teacher.update({
  where: {
    id: teacherId,
  },
  data: {
    lastAvailabilityImport: new Date(),
  },
});

  return availability.length;
}

export async function getAvailabilityCount() {
  return prisma.teacherAvailability.count();
}

export async function getTeacherAvailability(
  teacherId,
) {
  return prisma.teacherAvailability.findMany({
    where: {
      teacherId,
    },

    orderBy: [
      {
        date: "asc",
      },
      {
        timeSlot: "asc",
      },
    ],
  });
}