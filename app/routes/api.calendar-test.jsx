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

    const parsed =
      availability.map(
        (slot) =>
          parseTeacherAvailabilitySlot(
            slot,
          ),
      );

    return Response.json({
      success: true,
      teacher: teacher.firstName,
      slots: parsed.map((slot) => ({
        date: slot.date,
        timeSlot: slot.timeSlot,
        location:
          slot.preferredLocation,
        start:
          slot.start.toISOString(),
        end:
          slot.end.toISOString(),
      })),
    });
  } catch (error) {
    console.error(
      "Teacher availability test failed:",
      error,
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown teacher availability error",
      },
      {
        status: 500,
      },
    );
  }
}