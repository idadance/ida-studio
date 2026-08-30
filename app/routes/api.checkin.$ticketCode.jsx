import prisma from "../db.server";

export async function loader({
  params,
}) {
  const ticketCode =
    params.ticketCode;

  if (!ticketCode) {
    return Response.json(
      {
        ok: false,
        result: "INVALID",
        message:
          "Ticket code is missing.",
      },
      {
        status: 400,
      },
    );
  }

  const ticket =
    await prisma.ticketOrder.findUnique({
      where: {
        ticketCode,
      },

      include: {
        show: true,
        performance: true,
        reservation: true,
      },
    });

  if (!ticket) {
    return Response.json(
      {
        ok: false,
        result: "INVALID",
        message:
          "Ticket not found.",
      },
      {
        status: 404,
      },
    );
  }

  const reservation =
    ticket.reservation;

  // ==================================
  // CANCELED TICKET
  // ==================================

  if (ticket.status === "CANCELED") {
    return Response.json({
      ok: true,
      result: "CANCELED",

      customerName:
        ticket.customerName,

      performanceName:
        ticket.performance.name,

      showName:
        ticket.show.name,

      message:
        "This ticket is no longer valid.",
    });
  }

  // ==================================
  // PAYMENT NEEDED
  // ==================================

  if (
    !reservation ||
    reservation.status !==
      "CONFIRMED"
  ) {
    return Response.json({
      ok: true,
      result: "PAYMENT_NEEDED",

      customerName:
        ticket.customerName,

      performanceName:
        ticket.performance.name,

      showName:
        ticket.show.name,

      message:
        "Please see the box office.",
    });
  }

  // ==================================
  // GET ALL ACTIVE TICKETS
  // FOR THIS RESERVATION + SHOW
  //
  // Any QR code from this family for
  // this show can check in the group.
  // ==================================

  const familyTickets =
    await prisma.ticketOrder.findMany({
      where: {
        reservationId:
          reservation.id,

        showId:
          ticket.showId,

        status: {
          not: "CANCELED",
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    });

  const totalAdmissions =
    familyTickets.reduce(
      (sum, familyTicket) =>
        sum +
        familyTicket.quantity,
      0,
    );

  const checkedIn =
    familyTickets.reduce(
      (sum, familyTicket) =>
        sum +
        familyTicket.checkedInCount,
      0,
    );

  const remaining =
    Math.max(
      0,
      totalAdmissions -
        checkedIn,
    );

  // ==================================
  // FAMILY FULLY CHECKED IN
  // ==================================

  if (remaining <= 0) {
    return Response.json({
      ok: true,
      result: "ALREADY_USED",

      reservationId:
        reservation.id,

      showId:
        ticket.showId,

      customerName:
        reservation.customerName,

      performanceName:
        ticket.performance.name,

      showName:
        ticket.show.name,

      totalAdmissions,

      checkedIn,

      remaining: 0,

      message:
        "Everyone on this ticket order has already checked in.",
    });
  }

  // ==================================
  // READY FOR GROUP CHECK-IN
  //
  // Recognition only.
  // Nobody is checked in yet.
  // ==================================

  return Response.json({
    ok: true,
    result: "READY",

    reservationId:
      reservation.id,

    showId:
      ticket.showId,

    customerName:
      reservation.customerName,

    performanceName:
      ticket.performance.name,

    showName:
      ticket.show.name,

    totalAdmissions,

    checkedIn,

    remaining,

    message:
      remaining === 1
        ? "1 admission remaining."
        : `${remaining} admissions remaining.`,
  });
}