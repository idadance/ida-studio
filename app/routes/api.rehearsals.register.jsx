import { createSoloDuetRegistration } from "../services/soloDuetRegistration.server";

export async function loader() {
  return Response.json({
    success: true,
    message: "Solo/Duet registration API is running.",
  });
}

export async function action({ request }) {
  try {
    if (request.method !== "POST") {
      return Response.json(
        {
          error: "Method not allowed.",
        },
        {
          status: 405,
        },
      );
    }

    const data = await request.json();

    const registration =
      await createSoloDuetRegistration(data);

    return Response.json({
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

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Registration failed.",
      },
      {
        status: 400,
      },
    );
  }
}