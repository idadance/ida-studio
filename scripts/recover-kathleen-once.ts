import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import type { Prisma, PrismaClient, TicketOrder } from "@prisma/client";
import prismaClient from "../app/db.server";
import { escapeDriveQueryValue } from "../app/services/googleDriveQuery.js";

const prisma: PrismaClient = prismaClient;

const expected = {
  reservationId: "cmw7xxjg8009jtm3a4se0os9w",
  paypalOrderId: "9PJ07638TA686735J",
  paypalCaptureId: "2DP92567VF102494K",
  showId: "cmvfer0rm0002wu3a4l8bnqwz",
  customerName: "Kathleen O'Mara",
  oldEmail: "fabrickate@gmail.co",
  email: "fabrickate@gmail.com",
  performanceName: "Generations Dance Concert",
  totalAmount: 50,
  quantity: 2,
  ticketPrice: 25,
  digitalVideo: false,
} as const;

const includeReservation = {
  performance: true,
  ticketOrders: true,
} satisfies Prisma.ReservationInclude;

type RecoveryReservation = Prisma.ReservationGetPayload<{
  include: typeof includeReservation;
}>;

function validateIdentity(reservation: RecoveryReservation) {
  assert.equal(reservation.id, expected.reservationId, "Reservation ID mismatch.");
  assert.equal(reservation.customerName, expected.customerName, "Customer name mismatch.");
  assert.equal(reservation.paypalOrderId, expected.paypalOrderId, "Stored order ID mismatch.");
  assert.equal(reservation.paypalCaptureId, expected.paypalCaptureId, "Stored capture ID mismatch.");
  assert.equal(reservation.status, "CONFIRMED", "Reservation is not confirmed.");
  assert.equal(reservation.paymentMethod, "PAYPAL", "Payment method mismatch.");
  assert.equal(reservation.totalAmount, expected.totalAmount, "Paid total mismatch.");
  assert.equal(reservation.digitalVideo, expected.digitalVideo, "Video selection mismatch.");
  assert.equal(reservation.performance.organization, "GENERATIONS", "Organization mismatch.");
  assert.equal(reservation.performance.name, expected.performanceName, "Performance name mismatch.");
  assert.equal(reservation.ticketsSentAt, null, "Email was already recorded as sent.");
}

async function validateInitial(tx: Prisma.TransactionClient) {
  const reservation = await tx.reservation.findUnique({
    where: { id: expected.reservationId },
    include: includeReservation,
  });
  assert(reservation, "Target reservation was not found.");
  validateIdentity(reservation);
  assert.equal(reservation.customerEmail, expected.oldEmail, "Stored email is not the expected typo.");
  assert.equal(reservation.ticketOrders.length, 0, "Tickets already exist. STOP; inspect manually.");
  assert.equal(reservation.driveFolderId, null, "A customer folder is already linked. Inspect manually.");
  assert.equal(reservation.driveFolderLink, null, "A customer folder link already exists. Inspect manually.");

  const show = await tx.show.findUnique({
    where: { id: expected.showId },
    include: { boxOffice: true },
  });
  assert(show, "Target show was not found.");
  assert.equal(show.id, expected.showId, "Show ID mismatch.");
  assert.equal(show.performanceId, reservation.performanceId, "Show/performance mismatch.");
  assert(show.name.trim(), "Show name is missing.");
  assert.equal(show.boxOffice?.ticketPrice, expected.ticketPrice, "Current ticket price is not $25.");
  assert.equal(expected.quantity * expected.ticketPrice, expected.totalAmount);

  const performance = reservation.performance;
  for (const id of [
    performance.driveFolderId,
    performance.driveCustomersFolderId,
    performance.driveVideosFolderId,
  ]) {
    assert(id && /^[A-Za-z0-9_-]+$/.test(id), "Existing performance Drive folder IDs are required.");
  }

  const [otherPayments, token, reserved, held] = await Promise.all([
    tx.reservation.count({
      where: {
        id: { not: expected.reservationId },
        OR: [
          { paypalOrderId: expected.paypalOrderId },
          { paypalCaptureId: expected.paypalCaptureId },
        ],
      },
    }),
    tx.appSetting.findUnique({
      where: { key: "google_refresh_token" },
      select: { value: true },
    }),
    tx.ticketOrder.aggregate({
      where: { showId: expected.showId, status: { not: "CANCELED" } },
      _sum: { quantity: true },
    }),
    tx.waitlistEntry.aggregate({
      where: {
        showId: expected.showId,
        status: "OFFERED",
        offerExpiresAt: { gt: new Date() },
      },
      _sum: { quantity: true },
    }),
  ]);
  assert.equal(otherPayments, 0, "Another reservation has one of the payment IDs.");
  assert(token?.value.trim(), "Google refresh token is not configured.");
  const remainingSeats = show.capacity - (reserved._sum.quantity ?? 0) - (held._sum.quantity ?? 0);
  assert(remainingSeats >= expected.quantity, "Insufficient capacity; inspect manually.");
  return { reservation, show, remainingSeats };
}

async function readOnly<T>(read: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const [mode] = await tx.$queryRaw<{ transaction_read_only: string }[]>`SHOW transaction_read_only`;
    assert.equal(mode?.transaction_read_only, "on", "Read-only transaction was not confirmed.");
    return read(tx);
  }, { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 30000 });
}

async function validateFulfilled(
  tx: Prisma.TransactionClient,
  tickets: TicketOrder[],
  folderId: string,
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: expected.reservationId },
    include: includeReservation,
  });
  assert(reservation, "Reservation disappeared after ticket creation.");
  validateIdentity(reservation);
  assert.equal(reservation.customerEmail, expected.email, "Corrected email changed unexpectedly.");
  assert.equal(reservation.driveFolderId, folderId, "Customer folder changed unexpectedly.");
  assert.equal(reservation.driveFolderLink, `https://drive.google.com/drive/folders/${folderId}`);
  assert.equal(reservation.ticketOrders.length, expected.quantity, "Unexpected ticket count.");
  for (const original of tickets) {
    const ticket: TicketOrder | undefined = reservation.ticketOrders.find((row) => row.id === original.id);
    assert(ticket, "A recovery ticket is missing.");
    assert.equal(ticket.ticketCode, original.ticketCode, "A recovery QR code changed.");
    assert.equal(ticket.reservationId, expected.reservationId);
    assert.equal(ticket.showId, expected.showId);
    assert.equal(ticket.performanceId, reservation.performanceId);
    assert.equal(ticket.customerName, expected.customerName);
    assert.equal(ticket.customerEmail, expected.email);
    assert.equal(ticket.paymentMethod, "PAYPAL");
    assert.equal(ticket.status, "CONFIRMED");
    assert.equal(ticket.quantity, 1);
    assert.equal(ticket.ticketSubtotal, expected.ticketPrice);
    assert.equal(ticket.videoSubtotal, 0);
    assert.equal(ticket.totalAmount, expected.ticketPrice);
    assert.equal(ticket.digitalVideo, expected.digitalVideo);
  }
  return reservation;
}

async function main() {
  let execute = false;
  let phase = "argument/configuration validation";
  let databaseWriteAttempted = false;
  let emailAccepted = false;
  try {
    const args = process.argv.slice(2);
    assert(
      args.length === 0 ||
      (args.length === 1 && (args[0] === "--dry-run" || args[0] === "--execute")),
      "Only no arguments, --dry-run, or --execute are permitted.",
    );
    execute = args[0] === "--execute";
    for (const key of [
      "DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SENDGRID_API_KEY", "APP_URL",
    ]) {
      assert(process.env[key]?.trim(), `${key} must be configured; its value will not be printed.`);
    }
    assert.equal(new URL(process.env.APP_URL!).protocol, "https:", "APP_URL must use HTTPS.");

    phase = "read-only database preflight";
    const initial = await readOnly(validateInitial);
    console.log(JSON.stringify({
      mode: execute ? "EXECUTE" : "DRY-RUN: database reads only",
      target: expected,
      performanceId: initial.reservation.performanceId,
      showName: initial.show.name,
      showDate: initial.show.date,
      remainingSeats: initial.remainingSeats,
      plannedActions: [
        "Atomically correct this reservation email and insert two confirmed $25 quantity-one tickets.",
        "Use the fixed customer-folder lookup; generate assets once for each persistent ticket ID.",
        "Send the normal confirmation to the corrected address only after both uploads succeed.",
        "Set ticketsSentAt only after SendGrid accepts the email.",
      ],
      warnings: [
        "Payment IDs are checked against the database only; no payment-provider API is called.",
        "Execution requires no concurrent capture, recovery, or batch email for this reservation.",
        "Drive folder ambiguity/existing PDFs are checked only in execute mode.",
        "After any write or ambiguous outcome, inspect manually. Never blindly rerun --execute.",
      ],
    }, null, 2));
    if (!execute) return;

    phase = "read-only Drive preflight and helper loading";
    const { google } = await import("googleapis");
    google.options({ retry: false });
    const { getGoogleAuth } = await import("../app/services/google.server");
    const drive = google.drive({ version: "v3", auth: await getGoogleAuth() });
    const customersFolderId = initial.reservation.performance.driveCustomersFolderId;
    assert(customersFolderId);
    const matches = await drive.files.list({
      q: `'${escapeDriveQueryValue(customersFolderId)}' in parents
          and mimeType='application/vnd.google-apps.folder'
          and name='${escapeDriveQueryValue(expected.customerName)}'
          and trashed=false`,
      fields: "nextPageToken,incompleteSearch,files(id)",
      pageSize: 2,
    }, { retry: false });
    assert(!matches.data.incompleteSearch && !matches.data.nextPageToken, "Incomplete folder search.");
    const folders = matches.data.files;
    assert(folders, "Drive omitted the folder search results.");
    assert(folders.length <= 1, "Multiple customer folders matched. Inspect manually.");
    const existingFolderId = folders[0]?.id;
    if (folders.length === 1) {
      assert(existingFolderId, "Matched customer folder has no ID.");
      const [pdfs, owners] = await Promise.all([
        drive.files.list({
          q: `'${escapeDriveQueryValue(existingFolderId)}' in parents
              and mimeType='application/pdf' and trashed=false`,
          fields: "nextPageToken,incompleteSearch,files(id)",
          pageSize: 1,
        }, { retry: false }),
        prisma.reservation.count({ where: { driveFolderId: existingFolderId } }),
      ]);
      assert(
        pdfs.data.files && pdfs.data.files.length === 0 &&
        !pdfs.data.nextPageToken && !pdfs.data.incompleteSearch,
        "Existing or uncertain PDFs in the customer folder. Inspect manually.",
      );
      assert.equal(owners, 0, "Customer folder is already linked to a reservation.");
    }
    const [{ prepareCustomerFolder }, { generateTicketAssets }, { sendGenerationsTicketConfirmation }] =
      await Promise.all([
        import("../app/services/googleDrive.server"),
        import("../app/services/ticketGenerator.server"),
        import("../app/services/email.server"),
      ]);

    phase = "atomic email correction and two-ticket creation";
    databaseWriteAttempted = true;
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Reservation" WHERE id = ${expected.reservationId} FOR UPDATE NOWAIT`;
      await tx.$queryRaw`SELECT id FROM "Show" WHERE id = ${expected.showId} FOR UPDATE NOWAIT`;
      const current = await validateInitial(tx);
      for (const key of ["driveFolderId", "driveCustomersFolderId", "driveVideosFolderId"] as const) {
        assert.equal(current.reservation.performance[key], initial.reservation.performance[key]);
      }
      assert.equal(current.reservation.performanceId, initial.reservation.performanceId);
      const reservation = await tx.reservation.update({
        where: { id: expected.reservationId },
        data: { customerEmail: expected.email },
      });
      const tickets: TicketOrder[] = [];
      for (let index = 0; index < expected.quantity; index += 1) {
        tickets.push(await tx.ticketOrder.create({
          data: {
            customerName: expected.customerName,
            customerEmail: expected.email,
            quantity: 1,
            digitalVideo: expected.digitalVideo,
            paymentMethod: "PAYPAL",
            status: "CONFIRMED",
            ticketSubtotal: expected.ticketPrice,
            videoSubtotal: 0,
            totalAmount: expected.ticketPrice,
            ticketCode: randomUUID(),
            reservationId: expected.reservationId,
            showId: expected.showId,
            performanceId: reservation.performanceId,
          },
        }));
      }
      assert.equal(
        await tx.ticketOrder.count({ where: { reservationId: expected.reservationId } }),
        expected.quantity,
      );
      return { reservation, tickets, performance: current.reservation.performance, show: current.show };
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 30000 });
    console.log("Committed ticket IDs:", created.tickets.map((ticket) => ticket.id));

    phase = "customer-folder preparation";
    const folderId = await prepareCustomerFolder(created.performance, created.reservation, false);
    assert(folderId, "Customer folder preparation returned no ID.");
    if (existingFolderId) assert.equal(folderId, existingFolderId, "Unexpected customer folder.");
    await readOnly((tx) => validateFulfilled(tx, created.tickets, folderId));

    for (const ticket of created.tickets) {
      phase = `PDF/QR generation and upload for ticket ${ticket.id}`;
      await readOnly((tx) => validateFulfilled(tx, created.tickets, folderId));
      await generateTicketAssets(ticket.id);
    }

    phase = "final pre-email validation";
    const fulfilled = await readOnly((tx) => validateFulfilled(tx, created.tickets, folderId));
    assert(fulfilled.driveFolderLink);
    phase = "SendGrid submission (an error may have an ambiguous outcome)";
    await sendGenerationsTicketConfirmation({
      order: {
        firstName: "Kathleen",
        lastName: "O'Mara",
        email: expected.email,
        performanceName: created.performance.name,
        total: expected.totalAmount,
        shows: [{ name: created.show.name, quantity: expected.quantity }],
      },
      driveFolderLink: fulfilled.driveFolderLink,
    });
    emailAccepted = true;

    phase = "recording SendGrid acceptance";
    const sentAt = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Reservation" WHERE id = ${expected.reservationId} FOR UPDATE NOWAIT`;
      await validateFulfilled(tx, created.tickets, folderId);
      const updated = await tx.reservation.update({
        where: { id: expected.reservationId },
        data: { ticketsSentAt: new Date() },
      });
      return updated.ticketsSentAt;
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 30000 });
    console.log(JSON.stringify({
      result: "Fulfillment completed; SendGrid accepted the email, not proof of inbox delivery.",
      reservationId: expected.reservationId,
      email: expected.email,
      ticketIds: created.tickets.map((ticket) => ticket.id),
      driveFolderLink: fulfilled.driveFolderLink,
      ticketsSentAt: sentAt,
    }, null, 2));
  } catch (error) {
    console.error(`STOPPED during ${phase}. No automatic retry or cleanup was attempted.`);
    if (databaseWriteAttempted) {
      console.error("Do not rerun --execute. Inspect database/Drive/SendGrid manually, including commit outcomes.");
    }
    if (emailAccepted) {
      console.error("SendGrid already accepted the email. Do not send it again.");
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
