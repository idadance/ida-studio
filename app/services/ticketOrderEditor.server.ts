import prisma from "../db.server";

import {
  createTicketOrder,
} from "./ticketOrders.server";

import {
  ensureSeatsAvailable,
} from "./showValidation.server";

import {
  offerReleasedSeats,
} from "./waitlistOffers.server";

import {
  rebuildReservationTicketAssets,
} from "./ticketGenerator.server";


export async function updateTicketOrder({
  reservationId,
  account,
  quantities,
  digitalVideo,
}: {
  reservationId: string;
  account: "FW" | "PM";
  quantities: Record<string, number>;
  digitalVideo: boolean;
}) {
  if (
    account !== "FW" &&
    account !== "PM"
  ) {
    throw new Error(
      "Invalid studio account.",
    );
  }

  const reservation =
    await prisma.reservation.findUnique({
      where: {
        id: reservationId,
      },

      include: {
        performance: true,

        ticketOrders: {
          where: {
            status: {
              not: "CANCELED",
            },
          },

          include: {
            show: true,
          },
        },
      },
    });

  if (!reservation) {
    throw new Error(
      "Reservation not found.",
    );
  }

  // ======================================
  // STUDIO SAFETY
  // ======================================

  if (reservation.account !== account) {
    throw new Error(
      `This reservation belongs to ${
        reservation.account ||
        "another studio"
      } and cannot be edited from the ${account} dashboard.`,
    );
  }

  // ======================================
// DIGITAL VIDEO UPDATE
// ======================================

const addingDigitalVideo =
  digitalVideo &&
  !reservation.digitalVideo;

if (addingDigitalVideo) {
  const firstShow =
    reservation.ticketOrders[0]?.show;

  if (!firstShow) {
    throw new Error(
      "A show was not found for this reservation.",
    );
  }

  const showWithBoxOffice =
    await prisma.show.findUnique({
      where: {
        id: firstShow.id,
      },

      include: {
        boxOffice: true,
      },
    });

  if (!showWithBoxOffice) {
    throw new Error(
      "Show not found while adding Digital Video.",
    );
  }

  const videoPrice =
  showWithBoxOffice.boxOffice
    ?.digitalVideoPrice;

if (
  videoPrice === undefined ||
  videoPrice === null
) {
  throw new Error(
    "Digital Video price is not configured for this show.",
  );
}

  await prisma.reservation.update({
    where: {
      id: reservation.id,
    },

    data: {
  digitalVideo: true,
  digitalVideoPaid: false,

  totalAmount:
    reservation.totalAmount +
    videoPrice,
},
  });

  
}

  // ======================================
  // VALIDATE REQUESTED QUANTITIES
  // ======================================

  for (
    const [showId, quantity] of
    Object.entries(quantities)
  ) {
    if (
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      throw new Error(
        "Ticket quantities must be whole numbers of zero or greater.",
      );
    }

    const show =
      await prisma.show.findUnique({
        where: {
          id: showId,
        },
      });

    if (!show) {
      throw new Error(
        "Show not found.",
      );
    }

    if (
      show.performanceId !==
      reservation.performanceId
    ) {
      throw new Error(
        "This show does not belong to the customer's performance.",
      );
    }
  }

  // ======================================
  // CALCULATE CURRENT QUANTITIES
  // ======================================

  const currentQuantities:
    Record<string, number> = {};

  for (
    const ticket of
    reservation.ticketOrders
  ) {
    currentQuantities[ticket.showId] =
      (currentQuantities[
        ticket.showId
      ] ?? 0) +
      ticket.quantity;
  }

  // ======================================
  // CAPACITY CHECK INCREASES ONLY
  // ======================================

  const increases = [];

  for (
    const [showId, newQuantity] of
    Object.entries(quantities)
  ) {
    const currentQuantity =
      currentQuantities[showId] ?? 0;

    const increase =
      newQuantity - currentQuantity;

    if (increase > 0) {
      increases.push({
        showId,
        quantity: increase,
      });
    }
  }

  if (increases.length > 0) {
    await ensureSeatsAvailable({
      shows: increases,
    });
  }

  // ======================================
// APPLY DECREASES
//
// We preserve ticket history by
// changing released tickets to
// CANCELED instead of deleting them.
// ======================================

const decreases = [];

for (
  const [showId, newQuantity] of
  Object.entries(quantities)
) {
  const currentQuantity =
    currentQuantities[showId] ?? 0;

  const decrease =
    currentQuantity - newQuantity;

  if (decrease <= 0) {
    continue;
  }

  decreases.push({
    showId,
    quantity: decrease,
  });

  const activeTickets =
  reservation.ticketOrders
    .filter(
      (ticket: {
        showId: string;
      }) =>
        ticket.showId === showId,
    )
    .sort(
      (
        a: {
          createdAt: Date;
        },
        b: {
          createdAt: Date;
        },
      ) =>
        b.createdAt.getTime() -
        a.createdAt.getTime(),
    );

  let remainingToCancel =
    decrease;

  for (
    const ticket of activeTickets
  ) {
    if (remainingToCancel <= 0) {
      break;
    }

    // Our current system normally has
    // one TicketOrder per ticket.
    //
    // Protect older records that may
    // contain quantity > 1.
    if (
      ticket.quantity <=
      remainingToCancel
    ) {
      await prisma.ticketOrder.update({
        where: {
          id: ticket.id,
        },

        data: {
          status: "CANCELED",
        },
      });

      remainingToCancel -=
        ticket.quantity;
    } else {
      // Older multi-quantity record:
      // reduce only the requested number
      // instead of canceling the whole
      // record.
      const remainingQuantity =
        ticket.quantity -
        remainingToCancel;

      await prisma.ticketOrder.update({
        where: {
          id: ticket.id,
        },

        data: {
          quantity:
            remainingQuantity,

          ticketSubtotal:
            remainingQuantity *
            ticket.ticketSubtotal /
            ticket.quantity,

          totalAmount:
            remainingQuantity *
            ticket.ticketSubtotal /
            ticket.quantity +
            ticket.videoSubtotal,
        },
      });

      remainingToCancel = 0;
    }
  }

  if (remainingToCancel > 0) {
    throw new Error(
      "The requested ticket decrease could not be completed.",
    );
  }
}

// ======================================
// OFFER RELEASED SEATS TO WAITLIST
//
// All ticket decreases have now been
// completed successfully.
//
// Give released seats to eligible
// waitlist families before those seats
// can return to public availability.
// ======================================

const waitlistOffers = [];

for (const decrease of decreases) {
  const offerResult =
    await offerReleasedSeats({
      showId: decrease.showId,

      releasedQuantity:
        decrease.quantity,
    });

  waitlistOffers.push(
    ...offerResult.offered,
  );
}
// ======================================
// APPLY INCREASES
//
// Capacity was already checked above.
// Create one real TicketOrder record
// for each additional ticket.
// ======================================

for (const increase of increases) {
  const show =
    await prisma.show.findUnique({
      where: {
        id: increase.showId,
      },

      include: {
        boxOffice: true,
      },
    });

  if (!show) {
    throw new Error(
      "Show not found while adding tickets.",
    );
  }

  // Find an existing ticket so we can
  // preserve the ticket price originally
  // paid by this customer when possible.
  const existingTicket =
    reservation.ticketOrders.find(
      (ticket: {
        showId: string;
        ticketSubtotal: number;
        quantity: number;
      }) =>
        ticket.showId ===
        increase.showId,
    );

  const ticketPrice =
    existingTicket &&
    existingTicket.quantity > 0
      ? existingTicket.ticketSubtotal /
        existingTicket.quantity
      : show.boxOffice?.ticketPrice ??
        15;

  for (
    let i = 0;
    i < increase.quantity;
    i++
  ) {
    await createTicketOrder({
      show,

      quantity: 1,

      paymentMethod:
        reservation.paymentMethod,

      // The reservation may already
      // include video access. Do NOT
      // charge/add the video again when
      // creating an extra ticket.
      digitalVideo: false,

      customerName:
        reservation.customerName,

      customerEmail:
        reservation.customerEmail,

      ticketPrice,

      videoPrice: 0,

      performanceId:
        reservation.performanceId,

      shopifyOrderId:
        reservation.shopifyOrderId ??
        undefined,

      shopifyOrderNumber:
        reservation.shopifyOrderNumber ??
        undefined,

      reservationId:
        reservation.id,

      status: "PENDING",

      // Order editing rebuilds the
      // customer's complete ticket set
      // once all database changes have
      // finished.
      generateAssets: false,
    });
  }
}

// ======================================
// REBUILD CUSTOMER TICKET PDFs
//
// At this point all decreases and
// increases are complete.
//
// For confirmed reservations, remove
// the old ticket PDFs and regenerate
// every currently active ticket from
// the final database state.
// ======================================

const ticketsChanged =
  increases.length > 0 ||
  decreases.length > 0;

if (
  ticketsChanged &&
  reservation.status ===
    "CONFIRMED"
) {
  await rebuildReservationTicketAssets(
    reservation.id,
  );
}

return {
  success: true,

  reservationId:
    reservation.id,

  currentQuantities,

  requestedQuantities:
    quantities,

  increases,

  decreases,

  waitlistOffers,
};
}