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
        slot.day,
        slot.date,
        slot.timeSlot,
      ]
        .map((value) =>
          String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " "),
        )
        .join("|");

      const rawLocation = String(
        slot.preferredLocation ?? "",
      )
        .trim()
        .toLowerCase()
        .replace(/['"]/g, "");

      let hasFW = false;
      let hasPM = false;

      if (
        rawLocation.includes("either") ||
        rawLocation.includes("pm/fw") ||
        rawLocation.includes("fw/pm") ||
        rawLocation.includes("both")
      ) {
        hasFW = true;
        hasPM = true;
      } else {
        if (
          rawLocation === "fw" ||
          rawLocation.includes("fort washington")
        ) {
          hasFW = true;
        }

        if (
          rawLocation === "pm" ||
          rawLocation.includes("plymouth meeting")
        ) {
          hasPM = true;
        }
      }

      if (!uniqueSlots.has(key)) {
        uniqueSlots.set(key, {
          ...slot,
          _hasFW: hasFW,
          _hasPM: hasPM,
        });
      } else {
        const existing =
          uniqueSlots.get(key);

        existing._hasFW =
          existing._hasFW || hasFW;

        existing._hasPM =
          existing._hasPM || hasPM;
      }
    }
  }

  const availability = Array.from(
    uniqueSlots.values(),
  )
    .map((slot) => {
      let preferredLocation = "";

      if (slot._hasFW && slot._hasPM) {
        preferredLocation =
          "Fort Washington or Plymouth Meeting";
      } else if (slot._hasFW) {
        preferredLocation =
          "Fort Washington";
      } else if (slot._hasPM) {
        preferredLocation =
          "Plymouth Meeting";
      } else {
        preferredLocation =
          slot.preferredLocation;
      }

      const {
        _hasFW,
        _hasPM,
        ...cleanSlot
      } = slot;

      return {
        ...cleanSlot,
        preferredLocation,
      };
    })
    .sort(
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