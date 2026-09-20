import { createDAVClient } from "tsdav";

export async function loader() {
  try {
    const email =
      process.env.ICLOUD_CALENDAR_EMAIL;

    const password =
      process.env.ICLOUD_CALENDAR_PASSWORD;

    if (!email || !password) {
      return Response.json(
        {
          success: false,
          error:
            "iCloud calendar credentials are not configured.",
        },
        {
          status: 500,
        },
      );
    }

    const client = await createDAVClient({
      serverUrl: "https://caldav.icloud.com",
      credentials: {
        username: email,
        password,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    const calendars =
      await client.fetchCalendars();

    const calendar =
      calendars.find(
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
          start:
            "2026-09-20T00:00:00Z",
          end:
            "2026-10-20T23:59:59Z",
        },
      });

    return Response.json({
      success: true,
      calendar: calendar.displayName,
      eventCount: calendarObjects.length,
      events: calendarObjects.map(
        (event) => ({
          url: event.url,
          data: event.data,
        }),
      ),
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