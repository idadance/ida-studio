import prisma from "../db.server";

export async function loader({ params }) {
  const ticket =
    await prisma.ticketOrder.findUnique({
      where: {
        ticketCode:
          params.ticketCode,
      },

      select: {
        reservationId: true,
        showId: true,

        show: {
          select: {
            checkInOpen: true,
          },
        },

        performance: {
          select: {
            programUrl: true,
          },
        },
      },
    });

  if (!ticket) {
    return Response.json(
      {
        ok: false,
        error: "Ticket not found.",
      },
      {
        status: 404,
      },
    );
  }

  const activeTickets =
    await prisma.ticketOrder.findMany({
      where: {
        reservationId:
          ticket.reservationId,

        showId:
          ticket.showId,

        status: {
          not: "CANCELED",
        },
      },

      select: {
        quantity: true,
        checkedInCount: true,
      },
    });

  const totalAdmissions =
    activeTickets.reduce(
      (sum, item) =>
        sum + item.quantity,
      0,
    );

  const checkedIn =
    activeTickets.reduce(
      (sum, item) =>
        sum +
        item.checkedInCount,
      0,
    );

  const remaining =
    Math.max(
      0,
      totalAdmissions -
        checkedIn,
    );

  return Response.json({
    ok: true,

    totalAdmissions,
    checkedIn,
    remaining,

    checkInOpen:
      ticket.show.checkInOpen,

    fullyCheckedIn:
      totalAdmissions > 0 &&
      remaining === 0,

    programUrl:
      ticket.performance
        ?.programUrl || null,
  });
}