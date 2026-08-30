import prisma from "../db.server";

export async function action({ request }) {
  const formData =
    await request.formData();

  const reservationId =
    formData.get("reservationId");

  const showId =
    formData.get("showId");

  const quantity =
    Number(
      formData.get("quantity"),
    );

  // ==================================
  // BASIC VALIDATION
  // ==================================

  if (
    !reservationId ||
    !showId ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return Response.json(
      {
        ok: false,
        result: "INVALID",
        message:
          "Invalid check-in request.",
      },
      {
        status: 400,
      },
    );
  }

  const reservation =
    await prisma.reservation.findUnique({
      where: {
        id: reservationId,
      },

      include: {
        performance: true,
      },
    });

  if (!reservation) {
    return Response.json(
      {
        ok: false,
        result: "INVALID",
        message:
          "Reservation not found.",
      },
      {
        status: 404,
      },
    );
  }

  // ==================================
  // PAYMENT SAFETY
  // ==================================

  if (
    reservation.status !==
    "CONFIRMED"
  ) {
    return Response.json({
      ok: true,
      result: "PAYMENT_NEEDED",

      customerName:
        reservation.customerName,

      message:
        "Please see the box office.",
    });
  }

  // ==================================
  // CHECK-IN OPEN SAFETY
  //
  // Check-in is controlled separately
  // for each show. Even if someone has
  // an old/saved QR code, admissions
  // cannot be used until IDA opens
  // check-in for this show.
  // ==================================

  const show =
    await prisma.show.findUnique({
      where: {
        id: showId,
      },

      select: {
        id: true,
        checkInOpen: true,
      },
    });

  if (!show) {
    return Response.json(
      {
        ok: false,
        result: "INVALID",
        message:
          "Show not found.",
      },
      {
        status: 404,
      },
    );
  }

  if (!show.checkInOpen) {
    return Response.json({
      ok: true,
      result: "CHECKIN_CLOSED",

      customerName:
        reservation.customerName,

      message:
        "Check-in is not open yet.",
    });
  }

  // ==================================
  // ACTIVE TICKETS FOR THIS
  // RESERVATION + SHOW
  // ==================================

  const tickets =
    await prisma.ticketOrder.findMany({
      where: {
        reservationId:
          reservation.id,

        showId,

        status: {
          not: "CANCELED",
        },
      },

      include: {
        show: true,
      },

      orderBy: {
        createdAt: "asc",
      },
    });

  if (tickets.length === 0) {
    return Response.json(
      {
        ok: false,
        result: "INVALID",
        message:
          "No active tickets found.",
      },
      {
        status: 404,
      },
    );
  }

  const totalAdmissions =
    tickets.reduce(
      (sum, ticket) =>
        sum + ticket.quantity,
      0,
    );

  const alreadyCheckedIn =
    tickets.reduce(
      (sum, ticket) =>
        sum +
        ticket.checkedInCount,
      0,
    );

  const remaining =
    Math.max(
      0,
      totalAdmissions -
        alreadyCheckedIn,
    );

  if (remaining <= 0) {
    return Response.json({
      ok: true,
      result: "ALREADY_USED",

      customerName:
        reservation.customerName,

      showName:
        tickets[0].show.name,

      message:
        "Everyone on this ticket order has already checked in.",
    });
  }

  if (quantity > remaining) {
    return Response.json(
      {
        ok: false,
        result: "INVALID",

        customerName:
          reservation.customerName,

        showName:
          tickets[0].show.name,

        remaining,

        message:
          `Only ${remaining} admission${
            remaining === 1
              ? ""
              : "s"
          } remain.`,
      },
      {
        status: 400,
      },
    );
  }

  // ==================================
  // APPLY CHECK-INS SAFELY
  //
  // Each update succeeds only if that
  // TicketOrder still has enough unused
  // admissions at the exact moment the
  // database performs the update.
  //
  // This protects against two kiosks
  // trying to use the same admission
  // at nearly the same time.
  // ==================================

  let remainingToCheckIn =
    quantity;

  let actuallyAdmitted = 0;

  for (const ticket of tickets) {
    if (
      remainingToCheckIn <= 0
    ) {
      break;
    }

    // Re-read this ticket so we are
    // working from the latest database
    // value, not the earlier snapshot.
    const currentTicket =
      await prisma.ticketOrder.findUnique({
        where: {
          id: ticket.id,
        },
      });

    if (
      !currentTicket ||
      currentTicket.status ===
        "CANCELED"
    ) {
      continue;
    }

    const available =
      Math.max(
        0,
        currentTicket.quantity -
          currentTicket.checkedInCount,
      );

    if (available <= 0) {
      continue;
    }

    const admitNow =
      Math.min(
        available,
        remainingToCheckIn,
      );

    // Atomic safety condition:
    // only increment if there is still
    // room for this exact number.
    const updateResult =
      await prisma.ticketOrder.updateMany({
        where: {
          id: currentTicket.id,

          status: {
            not: "CANCELED",
          },

          checkedInCount: {
            lte:
              currentTicket.quantity -
              admitNow,
          },
        },

        data: {
          checkedInCount: {
            increment: admitNow,
          },
        },
      });

    if (updateResult.count === 1) {
      remainingToCheckIn -=
        admitNow;

      actuallyAdmitted +=
        admitNow;
    }
  }

  // If another kiosk used some or all
  // of these admissions while this
  // request was processing, never claim
  // that we admitted guests we did not
  // actually admit.

  if (actuallyAdmitted === 0) {
    return Response.json({
      ok: true,
      result: "ALREADY_USED",

      customerName:
        reservation.customerName,

      showName:
        tickets[0].show.name,

      message:
        "These admissions were already checked in.",
    });
  }

  // ==================================
  // SUCCESS
  // ==================================

  const newCheckedIn =
    alreadyCheckedIn +
    actuallyAdmitted;

  const newRemaining =
    Math.max(
      0,
      totalAdmissions -
        newCheckedIn,
    );

  return Response.json({
    ok: true,
    result: "CHECKED_IN",

    customerName:
      reservation.customerName,

    performanceName:
      reservation.performance.name,

    showName:
      tickets[0].show.name,

    admitted:
      actuallyAdmitted,

    checkedIn:
      newCheckedIn,

    totalAdmissions,

    remaining:
      newRemaining,

    message:
      actuallyAdmitted === 1
        ? "1 guest checked in. Welcome to IDA!"
        : `${actuallyAdmitted} guests checked in. Welcome to IDA!`,
  });
}