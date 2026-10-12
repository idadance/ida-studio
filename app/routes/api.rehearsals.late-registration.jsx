import {
  getSoloDuetLateRegistrationLink,
} from "../services/soloDuetRegistration.server";

function jsonResponse(data, init = {}) {
  return new Response(
    JSON.stringify(data),
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    },
  );
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return jsonResponse(
      {
        valid: false,
      },
      {
        status: 400,
      },
    );
  }

  const link =
    await getSoloDuetLateRegistrationLink(
      token,
    );

  if (!link) {
    return jsonResponse({
      valid: false,
    });
  }

  return jsonResponse({
    valid: true,
    familyName: link.familyName,
  });
}