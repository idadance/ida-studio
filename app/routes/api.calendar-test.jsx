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

    return Response.json({
      success: true,

      registrationId:
        registration.id,

      student:
        `${registration.studentFirstName} ${registration.studentLastName}`,

      teacherId:
        registration.teacher.id,

      teacher:
        registration.teacher.firstName,
    });
  } catch (error) {
    console.error(
      "Scheduling ID test failed:",
      error,
    );

    return Response.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown scheduling test error",
      },
      {
        status: 500,
      },
    );
  }
}