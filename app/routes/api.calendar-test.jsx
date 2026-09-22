import {
  createStudioCalendarEvent,
} from "../services/calendar.server.js";

export async function loader() {
  try {
    const event =
      await createStudioCalendarEvent({
        calendarName:
          "FW Studio A",

        title:
          "IDA CALENDAR TEST — DELETE ME",

        startTime:
          "2026-09-27T14:00:00-04:00",

        endTime:
          "2026-09-27T15:00:00-04:00",
      });

    return Response.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error(
      "Calendar write test failed:",
      error,
    );

    return Response.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown calendar write error",
      },
      {
        status: 500,
      },
    );
  }
}