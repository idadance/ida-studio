import {
  getRegistrations,
} from "../services/registration.server.js";

import {
  getRehearsalCandidateSlots,
} from "../services/rehearsalScheduling.server.js";

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

    const candidateSlots =
      await getRehearsalCandidateSlots(
        registration.id,
      );

    return Response.json({
      success: true,

      student:
        `${registration.studentFirstName} ${registration.studentLastName}`,

      teacher:
        registration.teacher?.firstName ??
        "No Preference",

      candidateSlots:
        candidateSlots.map((slot) => ({
          date: slot.date,
          day: slot.day,
          timeSlot: slot.timeSlot,
          location: slot.location,

          start:
            slot.start.toISOString(),

          end:
            slot.end.toISOString(),

          availableStudios:
            slot.availableStudios,
        })),
    });
  } catch (error) {
    console.error(
      "Final rehearsal candidate test failed:",
      error,
    );

    return Response.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown rehearsal candidate error",
      },
      {
        status: 500,
      },
    );
  }
}