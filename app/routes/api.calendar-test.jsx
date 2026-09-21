import {
  getAvailableStudiosAtLocation,
} from "../services/calendar.server.js";

import {
  getTeacherByName,
  getTeacherAvailability,
  parseTeacherAvailabilitySlot,
} from "../services/teacher.server.js";

export async function loader() {
  try {
    const teacher =
      await getTeacherByName("Amy");

    if (!teacher) {
      throw new Error(
        "Amy was not found.",
      );
    }

    const availability =
      await getTeacherAvailability(
        teacher.id,
        "2026-10-17T00:00:00Z",
        "2026-10-17T23:59:59Z",
      );

    const parsedSlots =
      availability
        .map((slot) =>
          parseTeacherAvailabilitySlot(
            slot,
          ),
        )
        .filter(Boolean);

    const slot = parsedSlots[0];

    if (!slot) {
      throw new Error(
        "Amy has no availability on October 17.",
      );
    }

    const studios =
      await getAvailableStudiosAtLocation(
        slot.preferredLocation,
        slot.start.toISOString(),
        slot.end.toISOString(),
      );

    return Response.json({
      success: true,
      teacher: teacher.firstName,

      teacherAvailability: {
        date: slot.date,
        timeSlot: slot.timeSlot,
        location:
          slot.preferredLocation,
        start:
          slot.start.toISOString(),
        end:
          slot.end.toISOString(),
      },

      studios,
    });
  } catch (error) {
    console.error(
      "Teacher and studio availability test failed:",
      error,
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown availability error",
      },
      {
        status: 500,
      },
    );
  }
}