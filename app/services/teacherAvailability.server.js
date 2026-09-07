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

  // Import the latest availability
  await prisma.teacherAvailability.createMany({
    data: availability.map((slot) => ({
      teacherId,

      day: slot.day,
      date: slot.date,
      timeSlot: slot.timeSlot,

      preferredLocation:
        slot.preferredLocation,

      notes: slot.notes,
    })),
  });

  return availability.length;
}