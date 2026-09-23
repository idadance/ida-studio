import {
  getTeacherByName,
} from "../services/teacher.server";

import {
  getTeacherAvailability,
} from "../services/teacherAvailability.server";

import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "https://events.instituteofdanceartistry.com",
  "Access-Control-Allow-Methods":
    "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type",
};

export async function loader({ request }) {
  const url = new URL(request.url);

  const teacherName =
    url.searchParams.get("teacher");

      if (teacherName === "ALL") {
    const teachers =
      await prisma.teacher.findMany({
        where: {
          active: true,
        },

        include: {
          availability: true,
        },
      });

    const uniqueSlots = new Map();

    for (const teacher of teachers) {
      for (const slot of teacher.availability) {
        const key = [
          slot.date,
          slot.timeSlot,
          slot.preferredLocation,
        ].join("|");

        if (!uniqueSlots.has(key)) {
          uniqueSlots.set(key, slot);
        }
      }
    }

    const availability = Array.from(
      uniqueSlots.values(),
    ).sort(
      (a, b) =>
        new Date(a.sortDate).getTime() -
          new Date(b.sortDate).getTime() ||
        a.timeSlot.localeCompare(b.timeSlot),
    );

    return new Response(
      JSON.stringify(availability),
      {
        headers: {
          "Content-Type":
            "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  if (!teacherName) {
    return new Response(
      JSON.stringify([]),
      {
        headers: {
          "Content-Type":
            "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  const teacher =
    await getTeacherByName(
      teacherName,
    );

  if (!teacher) {
    return new Response(
      JSON.stringify([]),
      {
        headers: {
          "Content-Type":
            "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  const availability =
    await getTeacherAvailability(
      teacher.id,
    );

  return new Response(
    JSON.stringify(availability),
    {
      headers: {
        "Content-Type":
          "application/json",
        ...corsHeaders,
      },
    },
  );
}

export async function options() {
  return new Response(null, {
    headers: corsHeaders,
  });
}