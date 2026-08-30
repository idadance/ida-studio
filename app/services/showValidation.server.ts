import prisma from "../db.server";

export async function ensureSeatsAvailable(
  order: any,
) {
  // ======================================
  // PERFORMANCE TICKET LIMIT
  //
  // The ticket limit applies to the
  // combined number of tickets across
  // ALL shows in the performance.
  // ======================================

  const requestedTickets =
    order.shows.reduce(
      (
        total: number,
        show: any,
      ) =>
        total +
        Number(show.quantity ?? 0),
      0,
    );

  if (
  !order.ignoreTicketLimit &&
  order.shows.length > 0
) {
    const firstShow =
      await prisma.show.findUnique({
        where: {
          id: order.shows[0].showId,
        },

        include: {
          boxOffice: true,
        },
      });

    if (!firstShow) {
      throw new Error(
        "Show not found.",
      );
    }

    const ticketLimitEnabled =
      firstShow.boxOffice
        ?.ticketLimitEnabled ??
      false;

    const ticketLimit =
      firstShow.boxOffice
        ?.ticketLimit ??
      0;

    if (
      ticketLimitEnabled &&
      ticketLimit > 0 &&
      requestedTickets >
        ticketLimit
    ) {
      throw new Error(
        `There is a limit of ${ticketLimit} tickets per customer for this performance.`,
      );
    }
  }

  // ======================================
  // SHOW CAPACITY / WAITLIST HOLDS
  // ======================================

  for (
    const requestedShow of
    order.shows
  ) {
    const show =
      await prisma.show.findUnique({
        where: {
          id:
            requestedShow.showId,
        },

        include: {
          ticketOrders: {
            where: {
              status: {
                not: "CANCELED",
              },
            },
          },

          waitlistEntries: {
  where: {
    status:
      "OFFERED",

    type:
      "SOLD_OUT",

    offerExpiresAt: {
      gt: new Date(),
    },
  },
},
        },
      });

    if (!show) {
      throw new Error(
        "Show not found.",
      );
    }

    const reservedSeats =
      show.ticketOrders.reduce(
        (
          total: number,
          ticketOrder: any,
        ) =>
          total +
          ticketOrder.quantity,
        0,
      );

    const heldWaitlistSeats =
      show.waitlistEntries.reduce(
        (
          total: number,
          entry: any,
        ) =>
          total +
          entry.quantity,
        0,
      );

    const occupiedSeats =
      reservedSeats +
      heldWaitlistSeats;

    const remainingSeats =
      show.capacity -
      occupiedSeats;

    if (
      requestedShow.quantity >
      remainingSeats
    ) {
      throw new Error(
        `${show.name} has sold out or no longer has enough seats available.`,
      );
    }
  }
}