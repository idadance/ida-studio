import {
  getRegistrations,
} from "../services/registration.server.js";

import {
  getTeacherAvailability,
  parseTeacherAvailabilitySlot,
} from "../services/teacher.server.js";

export async function loader() {
  try {
    const registrations =
      await getRegistrations();

    const registration =
      registrations.find(
        (item) =>
          item.studentFirstName === "test" &&
          item.studentLastName === "dancer",
      );

    if (!registration) {
      throw new Error(
        "Test dancer registration was not found.",
      );
    }

    if (!registration.teacher) {
      throw new Error(
        "Test dancer does not have an assigned teacher.",
      );
    }

    const teacherAvailability =
      await getTeacherAvailability(
        registration.teacher.id,
        "2026-09-01T00:00:00Z",
        "2026-12-31T23:59:59Z",
      );

    const teacherSlots =
      teacherAvailability
        .map((slot) =>
          parseTeacherAvailabilitySlot(
            slot,
          ),
        )
        .filter(Boolean);

    const matches =
      registration.availability.flatMap(
        (parentSlot) => {
          return teacherSlots
            .filter(
              (teacherSlot) =>
                teacherSlot.date ===
                  parentSlot.date &&
                teacherSlot.timeSlot ===
                  parentSlot.timeSlot &&
                teacherSlot.preferredLocation ===
                  parentSlot.preferredLocation,
            )
            .map((teacherSlot) => ({
              date: parentSlot.date,
              day: parentSlot.day,
              timeSlot:
                parentSlot.timeSlot,
              location:
                parentSlot.preferredLocation,
              start:
                teacherSlot.start.toISOString(),
              end:
                teacherSlot.end.toISOString(),
            }));
        },
      );

    return Response.json({
      success: true,

      student:
        `${registration.studentFirstName} ${registration.studentLastName}`,

      teacher:
        registration.teacher.firstName,

      matches,
    });
  } catch (error) {
    console.error(
      "Parent and teacher availability match test failed:",
      error,
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown availability matching error",
      },
      {
        status: 500,
      },
    );
  }
}