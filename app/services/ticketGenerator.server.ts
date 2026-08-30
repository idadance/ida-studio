import prisma from "../db.server";
import { generateLiveTicketQRCode } from "./qr.server";
import { generateTicketPDF } from "./ticketPdf.server";
import {
  prepareCustomerFolder,
  uploadTicketPDF,
  deleteCustomerTicketPDFs,
} from "./googleDrive.server";

export async function generateTicketAssets(
  ticketId: string,
) {
  console.log(
    `🎟 Generating ticket assets for ${ticketId}`,
  );

  const ticket =
    await prisma.ticketOrder.findUnique({
      where: {
        id: ticketId,
      },

      include: {
        show: true,
        performance: true,
        reservation: true,
      },
    });

  if (!ticket) {
    throw new Error(
      "Ticket not found.",
    );
  }

  if (!ticket.reservation) {
    throw new Error(
      "Reservation not found.",
    );
  }

  // Ticket PDFs should only be generated
// after THIS ticket has been paid.
//
// A Pay-by-Check reservation can remain
// PENDING when another show's tickets are
// still unpaid, while this show's tickets
// are already CONFIRMED.
if (
  ticket.status !==
  "CONFIRMED"
) {
  throw new Error(
    "Ticket assets cannot be generated for an unconfirmed ticket.",
  );
}

  console.log(
    `✅ Loaded ticket ${ticket.ticketCode}`,
  );

  // Ensure the customer's Google Drive
  // folder exists.
  const customerFolderId =
    await prepareCustomerFolder(
      ticket.performance,
      ticket.reservation,
      ticket.digitalVideo,
    );

  // Generate QR code.
  const qrCode =
    await generateLiveTicketQRCode(
      ticket.ticketCode!,
    );

  // Generate PDF.
  const pdf =
    await generateTicketPDF({
      ticket,
      qrCode,
    });

  console.log(
    `✅ Generated PDF (${pdf.length} bytes)`,
  );

  // ======================================
  // FRIENDLY TICKET NUMBER
  //
  // A customer can make multiple confirmed
  // purchases for the same performance.
  // Those reservations intentionally share
  // one Google Drive customer folder.
  //
  // Numbering therefore includes ALL active
  // tickets for this show from CONFIRMED
  // reservations sharing this folder.
  //
  // Pending Pay-by-Check reservations are
  // intentionally excluded.
  // ======================================

  const folderReservations =
    await prisma.reservation.findMany({
      where: {
        performanceId:
          ticket.performanceId,

        driveFolderId:
          customerFolderId,

        status: "CONFIRMED",
      },

      select: {
        id: true,
      },
    });

  const reservationIds =
    folderReservations.map(
      (reservation: {
        id: string;
      }) => reservation.id,
    );

  const siblingTickets =
    await prisma.ticketOrder.findMany({
      where: {
        reservationId: {
          in: reservationIds,
        },

        showId:
          ticket.showId,

        status: {
          not: "CANCELED",
        },
      },

      orderBy: [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],

      select: {
        id: true,
      },
    });

  const ticketIndex =
    siblingTickets.findIndex(
      (item: {
        id: string;
      }) =>
        item.id === ticket.id,
    );

  const ticketNumber =
    ticketIndex >= 0
      ? ticketIndex + 1
      : 1;

  const fileName =
    `${ticket.show.name} - Ticket ${ticketNumber}.pdf`;

  await uploadTicketPDF(
    pdf,
    customerFolderId,
    fileName,
  );

  console.log(
    `✅ Google Drive upload complete: ${fileName}`,
  );
}

export async function rebuildReservationTicketAssets(
  reservationId: string,
) {
  console.log(
    `🔄 Rebuilding customer ticket assets from reservation ${reservationId}`,
  );

  const reservation =
    await prisma.reservation.findUnique({
      where: {
        id: reservationId,
      },
    });

  if (!reservation) {
    throw new Error(
      "Reservation not found while rebuilding ticket assets.",
    );
  }

  if (
    reservation.status !==
    "CONFIRMED"
  ) {
    throw new Error(
      "Only confirmed reservations can rebuild ticket assets.",
    );
  }

  if (!reservation.driveFolderId) {
    throw new Error(
      "Customer Google Drive folder was not found.",
    );
  }

  // ======================================
  // IMPORTANT
  //
  // The Drive folder belongs to the
  // CUSTOMER for this performance, not
  // exclusively to one reservation.
  //
  // Find every CONFIRMED reservation that
  // shares this exact customer folder.
  //
  // Pending Pay-by-Check reservations are
  // deliberately excluded until payment is
  // received and they become CONFIRMED.
  // ======================================

  const folderReservations =
    await prisma.reservation.findMany({
      where: {
        performanceId:
          reservation.performanceId,

        driveFolderId:
          reservation.driveFolderId,

        status: "CONFIRMED",
      },

      select: {
        id: true,
      },
    });

  const reservationIds =
    folderReservations.map(
      (item: {
        id: string;
      }) => item.id,
    );

  // Find every active ticket belonging to
  // the customer's CONFIRMED reservations
  // in this shared performance folder.
  const activeTickets =
    await prisma.ticketOrder.findMany({
      where: {
        reservationId: {
          in: reservationIds,
        },

        status: {
          not: "CANCELED",
        },
      },

      orderBy: [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],

      select: {
        id: true,
      },
    });

  // Remove the existing ticket PDFs ONCE.
  // Non-PDF items such as the Performance
  // Videos shortcut remain untouched.
  await deleteCustomerTicketPDFs(
    reservation.driveFolderId,
  );

  // Rebuild ALL active tickets belonging
  // to confirmed reservations represented
  // by this shared customer folder.
  for (
    const ticket of
    activeTickets
  ) {
    await generateTicketAssets(
      ticket.id,
    );
  }

  console.log(
    `✅ Rebuilt ${activeTickets.length} confirmed ticket PDF(s) across ${folderReservations.length} confirmed reservation(s)`,
  );

  return {
    success: true,

    reservationId:
      reservation.id,

    reservationsIncluded:
      folderReservations.length,

    ticketsRebuilt:
      activeTickets.length,
  };
}