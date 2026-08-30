import prisma from "../db.server";

export async function loader({ request }) {
  const url = new URL(request.url);

  const reservationId =
    url.searchParams.get("reservationId");

  if (!reservationId) {
    return Response.json(
      { error: "Missing reservationId" },
      { status: 400 },
    );
  }

  const reservation =
  await prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },

    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      account: true,
      status: true,
      driveFolderLink: true,
      performanceId: true,

      performance: {
        select: {
          id: true,
          name: true,
          extraTicketRequestsEnabled: true,

          shows: {
            select: {
              id: true,
              name: true,
              date: true,
            },

            orderBy: {
              date: "asc",
            },
          },
        },
      },

      ticketOrders: {
        where: {
          status: {
            not: "CANCELED",
          },
        },

        select: {
          showId: true,
          quantity: true,
        },
      },
    },
  });

  if (!reservation) {
    return Response.json(
      { error: "Reservation not found" },
      { status: 404 },
    );
  }

  return Response.json(reservation);
}