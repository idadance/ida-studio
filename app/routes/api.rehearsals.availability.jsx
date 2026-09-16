import {
  getTeacherByName,
} from "../services/teacher.server";

import {
  getTeacherAvailability,
} from "../services/teacherAvailability.server";

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