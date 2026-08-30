import prisma from "../db.server";

export async function action({ request }) {
  if (request.method !== "POST") {
    return Response.json(
      {
        error: "Method not allowed.",
      },
      { status: 405 },
    );
  }

  try {
    const body = await request.json();

    const customerName = String(
      body.customerName ?? "",
    ).trim();

    const customerEmail = String(
      body.customerEmail ?? "",
    )
      .trim()
      .toLowerCase();

    const customerPhone = String(
      body.customerPhone ?? "",
    ).trim();

    const account = String(
      body.account ?? "",
    ).trim();

    const showId = String(
      body.showId ?? "",
    ).trim();

    const quantity = Number(
      body.quantity,
    );

    // ======================================
    // VALIDATE REQUEST
    // ======================================

    if (
      !customerName ||
      !customerEmail ||
      !showId ||
      !["FW", "PM"].includes(account) ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return Response.json(
        {
          error:
            "Please complete all required waitlist fields.",
        },
        { status: 400 },
      );
    }

    // ======================================
    // VERIFY SHOW EXISTS
    // ======================================

    const show =
      await prisma.show.findUnique({
        where: {
          id: showId,
        },

        select: {
          id: true,
        },
      });

    if (!show) {
      return Response.json(
        {
          error:
            "That show could not be found.",
        },
        { status: 404 },
      );
    }

    // ======================================
    // CREATE SOLD-OUT WAITLIST ENTRY
    //
    // This does NOT reserve seats.
    // No inventory is changed.
    // ======================================

    const waitlistEntry =
      await prisma.waitlistEntry.create({
        data: {
          customerName,
          customerEmail,

          customerPhone:
            customerPhone || null,

          account,
          quantity,
          showId,

          requestedAt:
            new Date(),

          type:
            "SOLD_OUT",

          status:
            "WAITING",
        },

        select: {
          id: true,
          showId: true,
          quantity: true,
          requestedAt: true,
        },
      });

    return Response.json({
      ok: true,
      waitlistEntry,
    });
  } catch (error) {
    console.error(
      "SOLD OUT WAITLIST REQUEST FAILED",
      error,
    );

    return Response.json(
      {
        error:
          "Your waitlist request could not be submitted. Please try again.",
      },
      { status: 500 },
    );
  }
}