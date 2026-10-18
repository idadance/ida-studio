
import {
  getSoloDuetAvailabilityUpdateLink,
  updateSoloDuetAvailability,
} from "../services/soloDuetRegistration.server";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "https://events.instituteofdanceartistry.com",
  "Access-Control-Allow-Methods":
    "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type",
};

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}

function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return jsonResponse(
      { valid: false },
      { status: 400 },
    );
  }

  const link =
    await getSoloDuetAvailabilityUpdateLink(
      token,
    );

  if (!link) {
    return jsonResponse({
      valid: false,
    });
  }

  const registration = link.registration;

  return jsonResponse({
    valid: true,
    registration: {
      id: registration.id,
      firstName: registration.studentFirstName,
      lastName: registration.studentLastName,
      studio: registration.studioCode,
      entryType: registration.entryType,
      teacher: registration.teacher
        ? registration.teacher.firstName
        : null,
      genre: registration.genre
        ? registration.genre.name
        : null,
      coordinatingDancerName:
        registration.coordinatingDancerName || "",
      currentAvailability:
        registration.availability,
    },
  });
}

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed.",
      },
      { status: 405 },
    );
  }

  try {
    const body = await request.json();

    const result =
      await updateSoloDuetAvailability({
        token: body.token,
        selectedRehearsals:
          body.selectedRehearsals,
      });

    return jsonResponse(result);
  } catch (error) {
    console.error(
      "Availability update failed:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update availability.",
      },
      { status: 400 },
    );
  }
}
