import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { findExistingStudioCalendarEvents } from "../services/calendar.server.js";

export async function loader({ request }) {
  await authenticate.admin(request);

  const rehearsals =
    await prisma.soloDuetScheduledRehearsal.findMany({
      orderBy: { startTime: "asc" },
    });

  const appointments = new Map();

  for (const rehearsal of rehearsals) {
    const key = [
      rehearsal.studioCalendar,
      rehearsal.startTime.toISOString(),
      rehearsal.endTime.toISOString(),
    ].join("|");

    if (!appointments.has(key)) {
      appointments.set(key, {
        studioCalendar: rehearsal.studioCalendar,
        startTime: rehearsal.startTime,
        endTime: rehearsal.endTime,
        rehearsalIds: [],
      });
    }

    appointments.get(key).rehearsalIds.push(rehearsal.id);
  }

  const results = [];

  for (const appointment of appointments.values()) {
    try {
      const matches = await findExistingStudioCalendarEvents({
        calendarName: appointment.studioCalendar,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      });

      results.push({
        ...appointment,
        matchCount: matches.length,
        matches,
      });
    } catch (error) {
      results.push({
        ...appointment,
        error: error.message,
      });
    }
  }

  return Response.json({
    appointmentCount: appointments.size,
    results,
  });
}