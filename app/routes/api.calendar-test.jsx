import {
  expandCalendarEvent,
  getCalendarClient,
  getStudioCalendars,
  parseCalendarEvent,
} from "../services/calendar.server.js";

export async function loader() {
  try {
    const client = await getCalendarClient();
    const calendars = await getStudioCalendars();

    const calendar = calendars.find(
      (item) =>
        item.displayName === "FW Studio B",
    );

    if (!calendar) {
      return Response.json(
        {
          success: false,
          error:
            "FW Studio B calendar was not found.",
        },
        {
          status: 404,
        },
      );
    }

    const calendarObjects =
      await client.fetchCalendarObjects({
        calendar,
        timeRange: {
          start: "2026-09-20T00:00:00Z",
          end: "2026-10-20T23:59:59Z",
        },
      });

    const rangeStart =
  "2026-09-20T00:00:00Z";

const rangeEnd =
  "2026-10-20T23:59:59Z";

const events = calendarObjects.flatMap(
  (calendarObject) => {
    const event =
      parseCalendarEvent(
        calendarObject.data,
      );

    if (!event) {
      return [];
    }

    return expandCalendarEvent(
      event,
      rangeStart,
      rangeEnd,
    ).map((occurrence) => ({
      title: occurrence.title,
      start:
        occurrence.start.toISOString(),
      end:
        occurrence.end.toISOString(),
    }));
  },
);

    return Response.json({
      success: true,
      calendar: calendar.displayName,
      eventCount: events.length,
      events,
    });
  } catch (error) {
    console.error(
      "iCloud calendar event test failed:",
      error,
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown calendar error",
      },
      {
        status: 500,
      },
    );
  }
}