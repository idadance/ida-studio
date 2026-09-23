import prisma from "../db.server";

export async function createSoloDuetRegistration(data) {
  const {
    firstName,
    lastName,
    grade,
    studio,
    email,
    type,

   partnerFirstName,
partnerLastName,

coordinatingDancerName,

teacher,
genre,

    paymentResponsibility,
    paymentMethod,
    totalAmount,

    selectedRehearsals,
  } = data;

  // ======================================
  // BASIC VALIDATION
  // ======================================

  if (
    !firstName?.trim() ||
    !lastName?.trim() ||
    !grade?.trim()
  ) {
    throw new Error(
      "Dancer name and grade are required.",
    );
  }

  if (!email?.trim()) {
    throw new Error(
      "Parent email is required.",
    );
  }

  if (!["FW", "PM"].includes(studio)) {
    throw new Error(
      "Please select a valid studio.",
    );
  }

  if (!["SOLO", "DUET"].includes(type)) {
    throw new Error(
      "Please select Solo or Duet.",
    );
  }

  if (
    type === "DUET" &&
    (!partnerFirstName?.trim() ||
      !partnerLastName?.trim())
  ) {
    throw new Error(
      "Duet partner information is required.",
    );
  }

  if (!genre?.trim()) {
    throw new Error(
      "Please select a genre.",
    );
  }

  if (
    !Array.isArray(selectedRehearsals) ||
    selectedRehearsals.length === 0
  ) {
    throw new Error(
      "Please select rehearsal availability.",
    );
  }

  // ======================================
  // FIND TEACHER
  // ======================================

  let teacherRecord = null;

  if (
    teacher &&
    teacher !== "No Preference"
  ) {
    teacherRecord =
      await prisma.teacher.findFirst({
        where: {
          firstName: teacher,
          active: true,
        },
      });

    if (!teacherRecord) {
      throw new Error(
        "Selected teacher was not found.",
      );
    }
  }

  // ======================================
  // FIND GENRE
  // ======================================

  const genreRecord =
    await prisma.genre.findUnique({
      where: {
        name: genre,
      },
    });

  if (!genreRecord) {
    throw new Error(
      "Selected genre was not found.",
    );
  }

  // ======================================
  // CREATE REGISTRATION
  // ======================================

  return prisma.soloDuetRegistration.create({
    data: {
      studentFirstName: firstName.trim(),
      studentLastName: lastName.trim(),
      grade: grade.trim(),
      studioCode: studio,
      customerEmail: email.trim().toLowerCase(),

      entryType: type,

      partnerFirstName:
        type === "DUET"
          ? partnerFirstName.trim()
          : null,

      partnerLastName:
  type === "DUET"
    ? partnerLastName.trim()
    : null,

coordinatingDancerName:
  coordinatingDancerName?.trim() || null,

teacherId: teacherRecord?.id ?? null,

      genreId: genreRecord.id,

      paymentResponsibility,
      paymentMethod:
        paymentMethod || null,

      paymentStatus: "PENDING",

      totalAmount,

      status: "REGISTERED",

      availability: {
        create: selectedRehearsals.map(
          (slot) => ({
            availabilityId: slot.id,
            day: slot.day,
            date: slot.date,
            timeSlot: slot.timeSlot,
            preferredLocation:
              slot.preferredLocation,
          }),
        ),
      },
    },

    include: {
      teacher: true,
      genre: true,
      availability: true,
    },
  });
}