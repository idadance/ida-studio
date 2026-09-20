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

    return Response.json({
      success: true,
      calendarCount: calendars.length,
      calendars: calendars.map(
        (calendar) => ({
          displayName:
            calendar.displayName,
          url: calendar.url,
        }),
      ),
    });
  } catch (error) {
    console.error(
      "iCloud calendar test failed:",
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