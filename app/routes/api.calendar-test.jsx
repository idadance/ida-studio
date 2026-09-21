import prisma from "../db.server";

const REGISTRATION_ID =
  "cmu6akie80001va3axsf47q8y";

const TEACHER_ID =
  "cmtnqddcw0000u33aowrldaof";

export async function loader() {
  try {
    const existing =
      await prisma.soloDuetScheduledRehearsal.findFirst({
        where: {
          registrationId:
            REGISTRATION_ID,
          teacherId:
            TEACHER_ID,
          studioCalendar:
            "FW Studio A",
          startTime: new Date(
            "2026-11-07T14:00:00-05:00",
          ),
        },
      });

    if (existing) {
      return Response.json({
        success: true,
        message:
          "Test rehearsal already exists.",
        rehearsal: existing,
      });
    }

    const rehearsal =
      await prisma.soloDuetScheduledRehearsal.create({
        data: {
          registrationId:
            REGISTRATION_ID,

          teacherId:
            TEACHER_ID,

          startTime: new Date(
            "2026-11-07T14:00:00-05:00",
          ),

          endTime: new Date(
            "2026-11-07T15:00:00-05:00",
          ),

          location: "FW",

          studioCalendar:
            "FW Studio A",
        },
      });

    return Response.json({
      success: true,
      message:
        "Temporary test rehearsal created.",
      rehearsal,
    });
  } catch (error) {
    console.error(
      "Test rehearsal creation failed:",
      error,
    );

    return Response.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown test rehearsal error",
      },
      {
        status: 500,
      },
    );
  }
}