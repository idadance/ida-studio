import prisma from "../db.server";
import { generateTicketAssets } from "./ticketGenerator.server";
import {
  prepareCustomerFolder,
} from "./googleDrive.server";

export async function receiveCheck({
  reservationId,
  showId,
  checkNumber,
  admin,
  account,
}) {
  if (
    account !== "FW" &&
    account !== "PM"
  ) {
    throw new Error(
      "Invalid studio account.",
    );
  }

  if (!showId) {
    throw new Error(
      "Show ID is required.",
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

  if (
    reservation.account !== account
  ) {
    throw new Error(
      `This reservation belongs to ${
        reservation.account ||
        "an unassigned studio"
      } and cannot be received from the ${account} dashboard.`,
    );
  }

  if (!reservation.driveFolderId) {
    throw new Error(
      "Customer Google Drive folder was not found.",
    );
  }

  if (!reservation.shopifyOrderId) {
    throw new Error(
      "Shopify Draft Order ID was not found.",
    );
  }

  // ======================================
  // FIND THIS SHOW'S UNPAID TICKETS
  // ======================================

  const showTickets =
    reservation.ticketOrders.filter(
      (ticket) =>
        ticket.showId === showId,
    );

  if (showTickets.length === 0) {
    throw new Error(
      "No active tickets were found for this show.",
    );
  }

  const pendingShowTickets =
    showTickets.filter(
      (ticket) =>
        ticket.status === "PENDING",
    );

  if (
    pendingShowTickets.length === 0
  ) {
    throw new Error(
      "This show's tickets are already paid.",
    );
  }

  const receivedAt =
    new Date();

  const cleanedCheckNumber =
    checkNumber?.trim() || null;

  // ======================================
  // CONFIRM ONLY THIS SHOW
  // ======================================

  await prisma.ticketOrder.updateMany({
    where: {
      reservationId,
      showId,
      status: "PENDING",
    },

    data: {
      status: "CONFIRMED",

      checkReceivedAt:
        receivedAt,

      checkNumber:
        cleanedCheckNumber,
    },
  });

  // ======================================
// GENERATE ONLY THIS SHOW'S TICKETS
//
// If the performance has already happened,
// still record the payment, but do not
// generate/send tickets after the fact.
// ======================================

const showDate =
  showTickets[0].show.date;

const shouldGenerateTickets =
  !showDate ||
  new Date(showDate) > new Date();

if (shouldGenerateTickets) {
  for (
    const ticket of
    pendingShowTickets
  ) {
    await generateTicketAssets(
      ticket.id,
    );
  }
} else {
  console.log(
    `⏭️ Skipping ticket generation for past show ${showTickets[0].show.name}`,
  );
}

  // ======================================
  // CHECK WHETHER ANY UNPAID TICKETS
  // REMAIN ON THE RESERVATION
  // ======================================

  const unpaidTickets =
    await prisma.ticketOrder.count({
      where: {
        reservationId,

        status: "PENDING",
      },
    });

  // ======================================
  // PARTIAL PAYMENT
  //
  // Other shows still need payment.
  // Keep the reservation and Shopify
  // Draft Order open.
  // ======================================

  if (unpaidTickets > 0) {
    console.log(
      `💰 Partial check payment received for reservation ${reservationId}, show ${showId}. ${unpaidTickets} unpaid ticket record(s) remain.`,
    );

    return {
      success: true,
      partial: true,

      reservationId,
      showId,

      showName:
        showTickets[0].show.name,

      ticketsConfirmed:
        pendingShowTickets.reduce(
          (sum, ticket) =>
            sum +
            ticket.quantity,
          0,
        ),

      remainingUnpaidTickets:
        unpaidTickets,
    };
  }

  // ======================================
  // FULLY PAID
  //
  // Every active show is now paid.
  // Complete the Shopify Draft Order.
  // ======================================

  console.log(
    `💰 All shows paid. Completing Shopify draft order ${reservation.shopifyOrderId}`,
  );

  const response =
    await admin.graphql(
      `#graphql
        mutation DraftOrderComplete($id: ID!) {
          draftOrderComplete(id: $id) {
            draftOrder {
              id
              name
              status
              order {
                id
                name
                displayFinancialStatus
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          id:
            reservation.shopifyOrderId,
        },
      },
    );

  const json =
    await response.json();

  if (json.errors) {
    throw new Error(
      JSON.stringify(
        json.errors,
        null,
        2,
      ),
    );
  }

  const result =
    json.data?.draftOrderComplete;

  if (!result) {
    throw new Error(
      "Shopify returned no draft order completion result.",
    );
  }

  if (
    result.userErrors?.length > 0
  ) {
    throw new Error(
      result.userErrors
        .map(
          (error) =>
            error.message,
        )
        .join(", "),
    );
  }

 // ======================================
// MARK RESERVATION FULLY CONFIRMED
// ======================================

await prisma.reservation.update({
  where: {
    id: reservationId,
  },

  data: {
    status: "CONFIRMED",

    checkReceivedAt:
      receivedAt,

    checkNumber:
      cleanedCheckNumber,

    ...(reservation.digitalVideo
      ? {
          digitalVideoPaid: true,
        }
      : {}),
  },
});

if (
  reservation.digitalVideo
) {
  await prepareCustomerFolder(
    reservation.performance,
    {
      ...reservation,
      digitalVideoPaid: true,
    },
    true,
  );
}

console.log(
  `✅ Shopify order completed: ${result.draftOrder.order?.name}`,
);

  return {
    success: true,
    partial: false,

    reservationId,
    showId,

    showName:
      showTickets[0].show.name,

    ticketsConfirmed:
      pendingShowTickets.reduce(
        (sum, ticket) =>
          sum +
          ticket.quantity,
        0,
      ),

    shopifyOrderId:
      result.draftOrder.order?.id,

    shopifyOrderName:
      result.draftOrder.order?.name,
  };
}