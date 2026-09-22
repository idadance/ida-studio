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

export async function getStudioOccupiedTimes(
  calendarName,
  rangeStart,
  rangeEnd,
  client = null,
  calendars = null,
) {
  if (
    !STUDIO_CALENDAR_NAMES.includes(
      calendarName,
    )
  ) {
    throw new Error(
      `Unknown studio calendar: ${calendarName}`,
    );
  }

  const calendarClient =
    client ??
    (await getCalendarClient());

  const availableCalendars =
    calendars ??
    (await calendarClient.fetchCalendars());

  const calendar =
    availableCalendars.find(
      (item) =>
        item.displayName ===
        calendarName,
    );

  if (!calendar) {
    throw new Error(
      `${calendarName} calendar was not found.`,
    );
  }

  const calendarObjects =
    await calendarClient.fetchCalendarObjects({
      calendar,
      timeRange: {
        start: rangeStart,
        end: rangeEnd,
      },
    });

  return calendarObjects.flatMap(
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
        calendar: calendarName,
        title: occurrence.title,
        start: occurrence.start,
        end: occurrence.end,
      }));
    },
  );
}

export async function getAvailableStudios(
  rangeStart,
  rangeEnd,
) {
  const client =
    await getCalendarClient();

  const calendars =
    await client.fetchCalendars();

  const requestedStart =
    new Date(rangeStart);

  const requestedEnd =
    new Date(rangeEnd);

  const results =
    await Promise.all(
      STUDIO_CALENDAR_NAMES.map(
        async (calendarName) => {
          const occupied =
            await getStudioOccupiedTimes(
              calendarName,
              rangeStart,
              rangeEnd,
              client,
              calendars,
            );

          const conflicts =
            occupied.filter((event) => {
              return (
                event.start <
                  requestedEnd &&
                event.end >
                  requestedStart
              );
            });

          return {
            calendar:
              calendarName,

            available:
              conflicts.length === 0,

            conflicts:
              conflicts.map(
                (event) => ({
                  title:
                    event.title,
                  start:
                    event.start,
                  end:
                    event.end,
                }),
              ),
          };
        },
      ),
    );

  return results;
}

export async function getAvailableStudiosAtLocation(
  location,
  rangeStart,
  rangeEnd,
) {
  const normalizedLocation =
    location?.trim().toUpperCase();

  if (
    normalizedLocation !== "FW" &&
    normalizedLocation !== "PM"
  ) {
    throw new Error(
      `Unknown studio location: ${location}`,
    );
  }

  const calendarNames =
    STUDIO_CALENDAR_NAMES.filter(
      (calendarName) =>
        calendarName.startsWith(
          `${normalizedLocation} Studio `,
        ),
    );

  const client =
    await getCalendarClient();

  const calendars =
    await client.fetchCalendars();

  const requestedStart =
    new Date(rangeStart);

  const requestedEnd =
    new Date(rangeEnd);

  const results =
    await Promise.all(
      calendarNames.map(
        async (calendarName) => {
          const occupied =
            await getStudioOccupiedTimes(
              calendarName,
              rangeStart,
              rangeEnd,
              client,
              calendars,
            );

          const conflicts =
            occupied.filter(
              (event) =>
                event.start <
                  requestedEnd &&
                event.end >
                  requestedStart,
            );

          return {
            calendar:
              calendarName,

            available:
              conflicts.length === 0,

            conflicts:
              conflicts.map(
                (event) => ({
                  title:
                    event.title,
                  start:
                    event.start,
                  end:
                    event.end,
                }),
              ),
          };
        },
      ),
    );

  return results;
}

export async function createStudioCalendarEvent({
  calendarName,
  title,
  startTime,
  endTime,
}) {
  if (
    !STUDIO_CALENDAR_NAMES.includes(
      calendarName,
    )
  ) {
    throw new Error(
      `Unknown studio calendar: ${calendarName}`,
    );
  }

  const client =
    await getCalendarClient();

  const calendars =
    await client.fetchCalendars();

  const calendar =
    calendars.find(
      (item) =>
        item.displayName ===
        calendarName,
    );

  if (!calendar) {
    throw new Error(
      `${calendarName} calendar was not found.`,
    );
  }

  const start =
    ICAL.Time.fromJSDate(
      new Date(startTime),
      true,
    );

  const end =
    ICAL.Time.fromJSDate(
      new Date(endTime),
      true,
    );

  const component =
    new ICAL.Component([
      "vcalendar",
      [],
      [],
    ]);

  component.updatePropertyWithValue(
    "version",
    "2.0",
  );

  component.updatePropertyWithValue(
    "prodid",
    "-//Institute of Dance Artistry//IDA Studio//EN",
  );

  const event =
    new ICAL.Event();

  event.uid =
    `ida-rehearsal-${crypto.randomUUID()}`;

  event.summary = title;
  event.startDate = start;
  event.endDate = end;

  component.addSubcomponent(
    event.component,
  );

  const filename =
    `${event.uid}.ics`;

  await client.createCalendarObject({
    calendar,
    filename,
    iCalString:
      component.toString(),
  });

  return {
    calendar: calendarName,
    uid: event.uid,
    filename,
  };
}