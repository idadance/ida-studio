import prisma from "../db.server";

export async function action({
  request,
}) {
  if (request.method !== "POST") {
    return Response.json(
      {
        error:
          "Method not allowed.",
      },
      { status: 405 },
    );
  }

  try {
    const body =
      await request.json();

    const reservationId =
      String(
        body.reservationId ?? "",
      ).trim();

    const showId =
      String(
        body.showId ?? "",
      ).trim();

    const quantity =
      Number(body.quantity);

    // ======================================
    // VALIDATE REQUEST
    // ======================================

    if (
      !reservationId ||
      !showId ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return Response.json(
        {
          error:
            "Please select a show and enter the number of additional tickets requested.",
        },
        { status: 400 },
      );
    }

    // ======================================
    // LOAD ORIGINAL RESERVATION
    // ======================================

    const reservation =
      await prisma.reservation.findUnique({
        where: {
          id: reservationId,
        },

        select: {
          customerName: true,
          customerEmail: true,
          account: true,
          performanceId: true,
        },
      });

    if (!reservation) {
      return Response.json(
        {
          error:
            "Reservation not found.",
        },
        { status: 404 },
      );
    }

    if (!reservation.account) {
      return Response.json(
        {
          error:
            "Reservation does not have a studio assigned.",
        },
        { status: 400 },
      );
    }

    // ======================================
    // VERIFY SHOW BELONGS TO PERFORMANCE
    // ======================================

    const show =
      await prisma.show.findFirst({
        where: {
          id: showId,
          performanceId:
            reservation.performanceId,
        },

        select: {
          id: true,
        },
      });

    if (!show) {
      return Response.json(
        {
          error:
            "That show is not part of this performance.",
        },
        { status: 400 },
      );
    }

    // ======================================
    // CREATE EXTRA-TICKET REQUEST
    //
    // This does NOT reserve seats.
    // It remains WAITING until IDA decides
    // to distribute remaining tickets.
    // ======================================

    const waitlistEntry =
      await prisma.waitlistEntry.create({
        data: {
          customerName:
            reservation.customerName,

          customerEmail:
            reservation.customerEmail,

          account:
            reservation.account,

          showId,
          quantity,

          type:
            "EXTRA_TICKETS",

          status:
            "WAITING",

          requestedAt:
            new Date(),
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
      "EXTRA TICKET REQUEST FAILED",
      error,
    );

    return Response.json(
      {
        error:
          "Your additional ticket request could not be submitted. Please try again.",
      },
      { status: 500 },
    );
  }
}