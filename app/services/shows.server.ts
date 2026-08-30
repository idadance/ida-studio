import prisma from "../db.server";

export async function getPublicShows() {
  const shows = await prisma.show.findMany({
    include: {
  boxOffice: true,

  ticketOrders: {
    where: {
      status: {
        not: "CANCELED",
      },
    },
  },

  waitlistEntries: {
    where: {
      status: "OFFERED",

      offerExpiresAt: {
        gt: new Date(),
      },
    },
  },
},
    orderBy: {
      date: "asc",
    },
  });

  return shows.map((show: any) => {
  const ticketsSold =
    show.ticketOrders.reduce(
      (
        total: number,
        order: any,
      ) =>
        total + order.quantity,
      0,
    );

  const heldWaitlistSeats =
    show.waitlistEntries.reduce(
      (
        total: number,
        entry: any,
      ) =>
        total + entry.quantity,
      0,
    );

  const remainingSeats = Math.max(
    0,
    show.capacity -
      ticketsSold -
      heldWaitlistSeats,
  );

  return {
    id: show.id,
    name: show.name,
    date: show.date,
    capacity: show.capacity,

    remainingSeats,

    soldOut:
      remainingSeats === 0,

    ticketPrice:
      show.boxOffice?.ticketPrice ??
      15,

    videoPrice:
      show.boxOffice
        ?.digitalVideoPrice ??
      15,

    digitalVideo:
      show.boxOffice
        ?.digitalVideo ??
      false,

    salesOpen:
      show.boxOffice?.salesOpen ??
      false,
  };
});
}