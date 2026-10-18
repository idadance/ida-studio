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

lateRegistrationToken,

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

const teacherCapacity =
  await getSoloDuetTeacherCapacity();

const selectedTeacherCapacity =
  teacherCapacity.find(
    (item) =>
      item.id === teacherRecord.id,
  );

if (selectedTeacherCapacity?.full) {
  throw new Error(
    `${teacherRecord.firstName} has reached their maximum number of Solo/Duet entries. Please select another teacher or No Preference.`,
  );
}
}

    // ======================================
  // VALIDATE REHEARSAL AVAILABILITY
  // ======================================

  if (!Array.isArray(selectedRehearsals)) {
    throw new Error(
      "Rehearsal availability is invalid.",
    );
  }

  if (
    teacherRecord &&
    selectedRehearsals.length === 0
  ) {
    const teacherAvailabilityCount =
      await prisma.teacherAvailability.count({
        where: {
          teacherId: teacherRecord.id,
        },
      });

    if (teacherAvailabilityCount > 0) {
      throw new Error(
        "Please select rehearsal availability.",
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

isLateRegistration:
  Boolean(lateRegistrationToken),

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

export async function getSoloDuetTeacherCapacity() {
  const teachers =
    await prisma.teacher.findMany({
      where: {
        active: true,
      },
      include: {
  registrations: true,
},
      orderBy: {
        firstName: "asc",
      },
    });

  return teachers.map((teacher) => {
    const registrations =
  teacher.registrations;

    const requested =
      registrations.reduce(
        (
          count,
          registration,
          index,
          allRegistrations,
        ) => {
          if (
            registration.entryType !== "DUET"
          ) {
            return count + 1;
          }

          const dancerLastName =
            registration.studentLastName
              ?.trim()
              .toLowerCase();

          const partnerLastName =
            registration.partnerLastName
              ?.trim()
              .toLowerCase();

          const matchingPartnerIndex =
            allRegistrations.findIndex(
              (other) => {
                if (
                  other.entryType !== "DUET" ||
                  other.id === registration.id
                ) {
                  return false;
                }

                const otherDancerLastName =
                  other.studentLastName
                    ?.trim()
                    .toLowerCase();

                const otherPartnerLastName =
                  other.partnerLastName
                    ?.trim()
                    .toLowerCase();

                return (
                  otherDancerLastName ===
                    partnerLastName &&
                  otherPartnerLastName ===
                    dancerLastName
                );
              },
            );

          if (
            matchingPartnerIndex !== -1 &&
            matchingPartnerIndex < index
          ) {
            return count;
          }

          return count + 1;
        },
        0,
      );

    return {
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      maxSoloDuets: teacher.maxSoloDuets,
      requested,
      full:
        requested >= teacher.maxSoloDuets,
    };
  });
}

export async function createSoloDuetLateRegistrationLink({
  familyName,
  expiresAt = null,
}) {
  const token = crypto.randomUUID();

  return prisma.soloDuetLateRegistrationLink.create({
    data: {
      token,
      familyName:
        familyName?.trim() || null,
      expiresAt,
    },
  });
}

export async function getSoloDuetLateRegistrationLink(
  token,
) {
  if (!token) {
    return null;
  }

  const link =
    await prisma.soloDuetLateRegistrationLink.findUnique({
      where: {
        token,
      },
    });

  if (!link) {
    return null;
  }

  if (link.usedAt) {
    return null;
  }

  if (
    link.expiresAt &&
    link.expiresAt < new Date()
  ) {
    return null;
  }

  return link;
}

export async function useSoloDuetLateRegistrationLink(
  token,
) {
  if (!token) {
    throw new Error(
      "This late registration link is invalid, expired, or has already been used.",
    );
  }

  const now = new Date();

  const result =
    await prisma.soloDuetLateRegistrationLink.updateMany({
      where: {
        token,
        usedAt: null,
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: now,
            },
          },
        ],
      },
      data: {
        usedAt: now,
      },
    });

  if (result.count !== 1) {
    throw new Error(
      "This late registration link is invalid, expired, or has already been used.",
    );
  }

  return true;
}

export async function createSoloDuetAvailabilityUpdateLink({
  registrationId,
  expiresAt = null,
}) {
  if (!registrationId) {
    throw new Error("Registration is required.");
  }

  const registration =
    await prisma.soloDuetRegistration.findUnique({
      where: {
        id: registrationId,
      },
    });

  if (!registration) {
    throw new Error("Registration not found.");
  }

  const token = crypto.randomUUID();

  return prisma.soloDuetAvailabilityUpdateLink.create({
    data: {
      token,
      registrationId,
      expiresAt,
    },
  });
}

export async function getSoloDuetAvailabilityUpdateLink(
  token,
) {
  if (!token) {
    return null;
  }

  const link =
    await prisma.soloDuetAvailabilityUpdateLink.findUnique({
      where: {
        token,
      },
      include: {
        registration: {
          include: {
            teacher: true,
            genre: true,
            availability: true,
          },
        },
      },
    });

  if (!link) {
    return null;
  }

  if (link.usedAt) {
    return null;
  }

  if (
    link.expiresAt &&
    link.expiresAt < new Date()
  ) {
    return null;
  }

  return link;
}

export async function updateSoloDuetAvailability({
  token,
  selectedRehearsals,
}) {
  if (!token) {
    throw new Error(
      "This availability update link is invalid, expired, or has already been used.",
    );
  }

  if (
    !Array.isArray(selectedRehearsals) ||
    selectedRehearsals.length === 0
  ) {
    throw new Error(
      "Please select at least one rehearsal time.",
    );
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const link =
      await tx.soloDuetAvailabilityUpdateLink.findUnique({
        where: {
          token,
        },
      });

    if (
      !link ||
      link.usedAt ||
      (link.expiresAt &&
        link.expiresAt < now)
    ) {
      throw new Error(
        "This availability update link is invalid, expired, or has already been used.",
      );
    }

    await tx.soloDuetRegistrationAvailability.deleteMany({
      where: {
        registrationId: link.registrationId,
      },
    });

    await tx.soloDuetRegistrationAvailability.createMany({
      data: selectedRehearsals.map((slot) => ({
        registrationId: link.registrationId,
        availabilityId: slot.id,
        day: slot.day,
        date: slot.date,
        timeSlot: slot.timeSlot,
        preferredLocation:
          slot.preferredLocation,
      })),
    });

    await tx.soloDuetAvailabilityUpdateLink.update({
      where: {
        id: link.id,
      },
      data: {
        usedAt: now,
      },
    });

    return {
      success: true,
      registrationId: link.registrationId,
    };
  });
}
  