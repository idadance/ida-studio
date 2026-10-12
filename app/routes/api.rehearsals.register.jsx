import {
  createSoloDuetRegistration,
  getSoloDuetTeacherCapacity,
  getSoloDuetLateRegistrationLink,
  useSoloDuetLateRegistrationLink,
} from "../services/soloDuetRegistration.server";

import { sendSoloDuetPartnerPayingConfirmation } from "../services/email.server";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "https://events.instituteofdanceartistry.com",
  "Access-Control-Allow-Methods":
    "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    },
  );
}

export async function loader() {
  const teachers =
    await getSoloDuetTeacherCapacity();

  return jsonResponse({
    success: true,
    teachers,
  });
}

export async function action({ request }) {
  try {
    if (request.method !== "POST") {
      return jsonResponse(
        {
          error: "Method not allowed.",
        },
        405,
      );
    }

    const data = await request.json();

    const lateRegistrationToken =
  data.lateRegistrationToken;

const lateRegistrationLink =
  await getSoloDuetLateRegistrationLink(
    lateRegistrationToken,
  );

if (!lateRegistrationLink) {
  return jsonResponse(
    {
      error:
        "Solo/Duet registration is closed. This private registration link is invalid, expired, or has already been used.",
    },
    403,
  );
}

    const registration =
  await createSoloDuetRegistration(data);

  await useSoloDuetLateRegistrationLink(
  lateRegistrationToken,
);

if (
  registration.entryType === "DUET" &&
  registration.paymentResponsibility === "PARTNER"
) {
  await sendSoloDuetPartnerPayingConfirmation({
    registration,
  });
}

return jsonResponse({
      success: true,

      registrationId:
        registration.id,

      registration: {
        id: registration.id,

        studentFirstName:
          registration.studentFirstName,

        studentLastName:
          registration.studentLastName,

        studioCode:
          registration.studioCode,

        entryType:
          registration.entryType,

        totalAmount:
          registration.totalAmount,

        paymentResponsibility:
          registration.paymentResponsibility,

        paymentMethod:
          registration.paymentMethod,
      },
    });
  } catch (error) {
    console.error(
      "❌ Solo/Duet registration failed:",
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Registration failed.",
      },
      400,
    );
  }
}

export async function options() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}