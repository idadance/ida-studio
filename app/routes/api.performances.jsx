import prisma from "../db.server";

export async function loader() {
  const performances = await prisma.performance.findMany({
    where: {
      status: "PUBLISHED",
    },
    include: {
  studios: true,

  shows: {
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
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const result = performances.map((performance) => ({
    id: performance.id,
    name: performance.name,
    description: performance.description,
    coverImage: performance.coverImage,

fwCheckVideoVariantId:
  performance.fwCheckVideoVariantId,

fwCreditVideoVariantId:
  performance.fwCreditVideoVariantId,

pmCheckVideoVariantId:
  performance.pmCheckVideoVariantId,

pmCreditVideoVariantId:
  performance.pmCreditVideoVariantId,
    studios: performance.studios.map((studio) => ({
  id: studio.id,
  name: studio.name,
  code: studio.code,
})),

    shows: performance.shows.map((show) => {
      const reservedSeats =
  show.ticketOrders.reduce(
    (total, order) =>
      total + order.quantity,
    0,
  );

const heldWaitlistSeats =
  show.waitlistEntries.reduce(
    (total, entry) =>
      total + entry.quantity,
    0,
  );

const remainingSeats = Math.max(
  0,
  show.capacity -
    reservedSeats -
    heldWaitlistSeats,
);

      return {
        id: show.id,
        name: show.name,
        date: show.date,

        capacity: show.capacity,
        remainingSeats,

        ticketPrice:
          show.boxOffice?.ticketPrice ?? 15,

        videoPrice:
          show.boxOffice?.digitalVideoPrice ?? 15,

        salesOpen:
          show.boxOffice?.salesOpen ?? false,
          
          ticketLimitEnabled:
  show.boxOffice?.ticketLimitEnabled ?? false,

ticketLimit:
  show.boxOffice?.ticketLimit ?? 4,

        // ---------- Fort Washington ----------

fwCheckTicketVariantId:
  show.fwCheckTicketVariantId,

fwCreditTicketVariantId:
  show.fwCreditTicketVariantId,

fwCheckVideoVariantId:
  show.fwCheckVideoVariantId,

fwCreditVideoVariantId:
  show.fwCreditVideoVariantId,

// ---------- Plymouth Meeting ----------

pmCheckTicketVariantId:
  show.pmCheckTicketVariantId,

pmCreditTicketVariantId:
  show.pmCreditTicketVariantId,

pmCheckVideoVariantId:
  show.pmCheckVideoVariantId,

pmCreditVideoVariantId:
  show.pmCreditVideoVariantId,
      };
    }),
  }));

  return Response.json(result);
}