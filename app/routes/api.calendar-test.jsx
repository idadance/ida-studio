import {
  getRegistrations,
} from "../services/registration.server.js";

export async function loader() {
  try {
    const registrations =
      await getRegistrations();

    const registration =
      registrations.find(
        (item) =>
          item.availability?.length > 0,
      );

    if (!registration) {
      throw new Error(
        "No registration with availability was found.",
      );
    }

    return Response.json({
      success: true,

      registration: {
        student:
          `${registration.studentFirstName} ${registration.studentLastName}`,

        status:
          registration.status,

        teacher:
          registration.teacher
            ? registration.teacher.firstName
            : "No Preference",

        studio:
          registration.studioCode,

        availability:
          registration.availability.map(
            (slot) => ({
              day: slot.day,
              date: slot.date,
              timeSlot:
                slot.timeSlot,
              preferredLocation:
                slot.preferredLocation,
            }),
          ),
      },
    });
  } catch (error) {
    console.error(
      "Registration availability test failed:",
      error,
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown registration availability error",
      },
      {
        status: 500,
      },
    );
  }
}