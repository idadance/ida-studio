import prisma from "../db.server";
import { sendPaidTicketConfirmation } from "./email.server";

/**
 * Send a customer's completed ticket folder.
 *
 * Safety rules:
 * - Reservation must belong to the current studio.
 * - Reservation must be CONFIRMED.
 * - Email must not already have been sent.
 * - Drive folder must exist.
 * - At least one active ticket must exist.
 * - ticketsSentAt is ONLY stamped after
 *   SendGrid successfully accepts the email.
 */
export async function sendReservationTickets({
  reservationId,
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
  // Studio safety check
  // ======================================

  if (
    reservation.account !== account
  ) {
    throw new Error(
      `This reservation belongs to ${
        reservation.account ||
        "an unassigned studio"
      } and cannot be sent from the ${account} dashboard.`,
    );
  }

  // ======================================
  // Reservation must be confirmed
  // ======================================

  if (
    reservation.status !==
    "CONFIRMED"
  ) {
    throw new Error(
      "Tickets cannot be sent because this reservation is not confirmed.",
    );
  }

  // ======================================
  // Prevent accidental duplicate sending
  // ======================================

  if (reservation.ticketsSentAt) {
    throw new Error(
      "Tickets have already been sent for this reservation.",
    );
  }

  // ======================================
  // Drive folder must exist
  // ======================================

  if (
    !reservation.driveFolderLink
  ) {
    throw new Error(
      "Customer Google Drive folder link was not found.",
    );
  }

  // ======================================
  // Must have active tickets
  // ======================================

  if (
    reservation.ticketOrders.length ===
    0
  ) {
    throw new Error(
      "No active tickets were found for this reservation.",
    );
  }

  // ======================================
  // Group TicketOrder records by Show
  //
  // Newer reservations may have one
  // TicketOrder record per individual
  // ticket. Older records may contain a
  // quantity greater than 1.
  //
  // Using ticket.quantity handles both.
  // ======================================

  const showMap = new Map();

  for (
    const ticket of
    reservation.ticketOrders
  ) {
    const existing =
      showMap.get(ticket.showId);

    if (existing) {
      existing.quantity +=
        ticket.quantity;
    } else {
      showMap.set(
        ticket.showId,
        {
          name:
            ticket.show.name,

          quantity:
            ticket.quantity,
        },
      );
    }
  }

  const shows =
    Array.from(
      showMap.values(),
    );

  // ======================================
  // Build the same order shape our proven
  // email function already expects
  // ======================================

  const nameParts =
    reservation.customerName
      .trim()
      .split(/\s+/);

  const firstName =
    nameParts[0] ||
    "Customer";

  const lastName =
    nameParts
      .slice(1)
      .join(" ");

  const order = {
    firstName,
    lastName,

    email:
      reservation.customerEmail,

    account,

    performanceId:
      reservation.performanceId,

    performanceName:
      reservation.performance.name,

    shows,

    video:
      reservation.digitalVideo,
  };

  // ======================================
  // Send email
  //
  // If SendGrid throws, execution stops
  // here and ticketsSentAt remains null.
  // ======================================

  await sendPaidTicketConfirmation({
    order,

    driveFolderLink:
      reservation.driveFolderLink,
  });

  // ======================================
  // Only mark sent AFTER email succeeds
  // ======================================

  const sentAt = new Date();

  await prisma.reservation.update({
    where: {
      id: reservation.id,
    },

    data: {
      ticketsSentAt:
        sentAt,
    },
  });

  console.log(
    `✅ Ticket folder sent to ${reservation.customerEmail}`,
  );

  return {
    success: true,

    reservationId:
      reservation.id,

    customerName:
      reservation.customerName,

    customerEmail:
      reservation.customerEmail,

    ticketsSentAt:
      sentAt,
  };
}