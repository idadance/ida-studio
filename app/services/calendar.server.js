import { createDAVClient } from "tsdav";

const STUDIO_CALENDAR_NAMES = [
  "FW Studio A",
  "FW Studio B",
  "FW Studio C",
  "FW Studio D",
  "PM Studio A",
  "PM Studio B",
  "PM Studio C",
];

export async function getCalendarClient() {
  const email =
    process.env.ICLOUD_CALENDAR_EMAIL;

  const password =
    process.env.ICLOUD_CALENDAR_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "iCloud calendar credentials are not configured.",
    );
  }

  return createDAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: {
      username: email,
      password,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

export async function getStudioCalendars() {
  const client =
    await getCalendarClient();

  const calendars =
    await client.fetchCalendars();

  return calendars.filter((calendar) =>
    STUDIO_CALENDAR_NAMES.includes(
      calendar.displayName,
    ),
  );
}