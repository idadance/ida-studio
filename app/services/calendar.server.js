import { createDAVClient } from "tsdav";

import ICAL from "ical.js";

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

export function parseCalendarEvent(icsData) {
  if (!icsData) {
    return null;
  }

  const parsed = ICAL.parse(icsData);
  const component = new ICAL.Component(parsed);
  const vevent = component.getFirstSubcomponent("vevent");

  if (!vevent) {
    return null;
  }

  return new ICAL.Event(vevent);
}

export function expandCalendarEvent(
  event,
  rangeStart,
  rangeEnd,
) {
  if (!event) {
    return [];
  }

  const startBoundary =
    ICAL.Time.fromJSDate(
      new Date(rangeStart),
      true,
    );

  const endBoundary =
    ICAL.Time.fromJSDate(
      new Date(rangeEnd),
      true,
    );

  const duration =
    event.endDate.subtractDate(
      event.startDate,
    );

  // One-time event
  if (!event.isRecurring()) {
    if (
      event.endDate.compare(
        startBoundary,
      ) <= 0 ||
      event.startDate.compare(
        endBoundary,
      ) >= 0
    ) {
      return [];
    }

    return [
      {
        title: event.summary,
        start: event.startDate.toJSDate(),
        end: event.endDate.toJSDate(),
      },
    ];
  }

  // Recurring event
  const iterator = event.iterator();
  const occurrences = [];

  let occurrence;

  while (
    (occurrence = iterator.next())
  ) {
    if (
      occurrence.compare(
        endBoundary,
      ) >= 0
    ) {
      break;
    }

    const occurrenceEnd =
      occurrence.clone();

    occurrenceEnd.addDuration(
      duration,
    );

    if (
      occurrenceEnd.compare(
        startBoundary,
      ) > 0
    ) {
      occurrences.push({
        title: event.summary,
        start:
          occurrence.toJSDate(),
        end:
          occurrenceEnd.toJSDate(),
      });
    }
  }

  return occurrences;
}