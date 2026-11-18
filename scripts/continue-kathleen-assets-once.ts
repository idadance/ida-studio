import assert from "node:assert/strict";
import process from "node:process";
import type { Prisma, PrismaClient, TicketOrder } from "@prisma/client";
import prismaClient from "../app/db.server";

const prisma: PrismaClient = prismaClient;
const expected = {
  reservationId: "cmw7xxjg8009jtm3a4se0os9w",
  customerName: "Kathleen O'Mara",
  email: "fabrickate@gmail.com",
  paypalOrderId: "9PJ07638TA686735J",
  paypalCaptureId: "2DP92567VF102494K",
  totalAmount: 50,
  ticketPrice: 25,
  quantity: 2,
  showId: "cmvfer0rm0002wu3a4l8bnqwz",
  performanceId: "cmvfej7pv0000wu3av4zdg2sm",
  performanceName: "Generations Dance Concert",
  driveFolderId: "1aZxsawMpPmVYKa7UMBF4rJ-HInpwIkCs",
  tickets: [
    { id: "cmwlisqlv0001rr6ef0qvha6u", code: "4b2b636d-2dd9-4ab3-b04c-bbb3acf19a64" },
    { id: "cmwlisqm60003rr6ed668zs3w", code: "ac0e9791-7984-4bad-b311-f7e59c3a91a2" },
  ],
} as const;
const folderLink = `https://drive.google.com/drive/folders/${expected.driveFolderId}`;

async function validateDatabase(tx: Prisma.TransactionClient) {
  const reservation = await tx.reservation.findUnique({
    where: { id: expected.reservationId },
    include: {
      performance: true,
      ticketOrders: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
  assert(reservation, "Exact reservation was not found.");
  assert.equal(reservation.id, expected.reservationId);
  assert.equal(reservation.customerName, expected.customerName, "Customer name mismatch.");
  assert.equal(reservation.customerEmail, expected.email, "Corrected recipient mismatch.");
  assert.equal(reservation.paypalOrderId, expected.paypalOrderId, "Stored order ID mismatch.");
  assert.equal(reservation.paypalCaptureId, expected.paypalCaptureId, "Stored capture ID mismatch.");
  assert.equal(reservation.status, "CONFIRMED");
  assert.equal(reservation.paymentMethod, "PAYPAL");
  assert.equal(reservation.totalAmount, expected.totalAmount);
  assert.equal(reservation.digitalVideo, false);
  assert.equal(reservation.performanceId, expected.performanceId);
  assert.equal(reservation.performance.id, expected.performanceId);
  assert.equal(reservation.performance.organization, "GENERATIONS");
  assert.equal(reservation.performance.name, expected.performanceName);
  assert.equal(reservation.driveFolderId, expected.driveFolderId, "Exact customer folder is required.");
  assert.equal(reservation.driveFolderLink, folderLink, "Customer folder link mismatch.");
  assert.equal(reservation.ticketsSentAt, null, "Email is already recorded as sent. STOP.");
  assert.equal(reservation.ticketOrders.length, expected.quantity, "Exactly two existing tickets are required.");

  for (const known of expected.tickets) {
    const ticket: TicketOrder | undefined = reservation.ticketOrders.find((row) => row.id === known.id);
    assert(ticket, `Missing exact existing ticket ${known.id}.`);
    assert.equal(ticket.ticketCode, known.code, "Persistent QR code mismatch.");
    assert.equal(ticket.reservationId, expected.reservationId);
    assert.equal(ticket.customerName, expected.customerName);
    assert.equal(ticket.customerEmail, expected.email);
    assert.equal(ticket.showId, expected.showId);
    assert.equal(ticket.performanceId, expected.performanceId);
    assert.equal(ticket.status, "CONFIRMED");
    assert.equal(ticket.paymentMethod, "PAYPAL");
    assert.equal(ticket.quantity, 1);
    assert.equal(ticket.ticketSubtotal, expected.ticketPrice);
    assert.equal(ticket.videoSubtotal, 0);
    assert.equal(ticket.totalAmount, expected.ticketPrice);
    assert.equal(ticket.digitalVideo, false);
  }
  assert.equal(
    reservation.ticketOrders.reduce((sum, ticket) => sum + ticket.totalAmount, 0),
    expected.totalAmount,
  );
  for (const id of [
    reservation.performance.driveFolderId,
    reservation.performance.driveCustomersFolderId,
    reservation.performance.driveVideosFolderId,
  ]) {
    assert(id && /^[A-Za-z0-9_-]+$/.test(id), "Existing performance folders are required; do not create folders.");
  }

  const [show, otherFolderOwners, otherPayments, token] = await Promise.all([
    tx.show.findUnique({ where: { id: expected.showId } }),
    tx.reservation.count({
      where: { driveFolderId: expected.driveFolderId, id: { not: expected.reservationId } },
    }),
    tx.reservation.count({
      where: {
        id: { not: expected.reservationId },
        OR: [
          { paypalOrderId: expected.paypalOrderId },
          { paypalCaptureId: expected.paypalCaptureId },
        ],
      },
    }),
    tx.appSetting.findUnique({ where: { key: "google_refresh_token" }, select: { value: true } }),
  ]);
  assert(show, "Exact show was not found.");
  assert.equal(show.id, expected.showId);
  assert.equal(show.performanceId, expected.performanceId);
  assert(show.name.trim(), "Show name is missing.");
  assert.equal(otherFolderOwners, 0, "Customer folder is shared with another reservation. STOP.");
  assert.equal(otherPayments, 0, "Another reservation has one of the payment IDs. STOP.");
  assert(token?.value.trim(), "Google refresh token is not configured.");
  return { reservation, show };
}

async function readOnly<T>(read: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const [mode] = await tx.$queryRaw<{ transaction_read_only: string }[]>`SHOW transaction_read_only`;
    assert.equal(mode?.transaction_read_only, "on", "Read-only transaction was not confirmed.");
    return read(tx);
  }, { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 30000 });
}

async function main() {
  let phase = "argument/configuration validation";
  let externalActionsStarted = false;
  let emailAccepted = false;
  try {
    const args = process.argv.slice(2);
    assert(
      args.length === 0 ||
      (args.length === 1 && (args[0] === "--dry-run" || args[0] === "--execute")),
      "Only no arguments, --dry-run, or --execute are permitted.",
    );
    const execute = args[0] === "--execute";
    for (const key of [
      "DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SENDGRID_API_KEY", "APP_URL",
    ]) {
      assert(process.env[key]?.trim(), `${key} must be configured; its value will not be printed.`);
    }
    const appUrl = process.env.APP_URL;
    assert(appUrl);
    assert.equal(new URL(appUrl).protocol, "https:", "APP_URL must use HTTPS.");

    phase = "read-only database validation";
    const initial = await readOnly(validateDatabase);
    console.log(JSON.stringify({
      mode: execute ? "EXECUTE" : "DRY-RUN: database reads only",
      target: expected,
      driveFolderLink: folderLink,
      showName: initial.show.name,
      plannedActions: [
        "Require the exact existing customer folder to be empty and unambiguous.",
        "Generate/upload one asset for each of the two existing ticket IDs; preserve all QR codes.",
        "Verify exactly two expected PDFs, then send the normal confirmation to the corrected address.",
        "Only after SendGrid acceptance, update this reservation's ticketsSentAt.",
      ],
      warnings: [
        "No reservation/ticket creation or ticket updates; no payment-provider API calls.",
        "Single-use execution requires exclusive access: no other fulfillment or email sender for this reservation.",
        "Dry-run does not contact Drive or SendGrid and cannot determine existing PDF or email-provider state.",
        "Any pre-existing folder content or non-null ticketsSentAt refuses execution.",
        "After any partial or ambiguous execution, STOP for manual inspection; never blindly rerun.",
        "An attempt that leaves no external evidence cannot be detected from database state alone.",
      ],
    }, null, 2));
    if (!execute) return;

    phase = "loading execution-only helpers";
    const { google } = await import("googleapis");
    google.options({ retry: false, timeout: 60000 });
    const { getGoogleAuth } = await import("../app/services/google.server");
    const [{ generateTicketAssets }, { sendGenerationsTicketConfirmation }] = await Promise.all([
      import("../app/services/ticketGenerator.server"),
      import("../app/services/email.server"),
    ]);
    const drive = google.drive({ version: "v3", auth: await getGoogleAuth() });
    const customersFolderId = initial.reservation.performance.driveCustomersFolderId;
    assert(customersFolderId);

    const inspectFolder = async (expectedPdfCount: number) => {
      const metadata = await drive.files.get({
        fileId: expected.driveFolderId,
        fields: "id,name,mimeType,trashed,parents,capabilities(canAddChildren)",
      }, { retry: false });
      assert.equal(metadata.data.id, expected.driveFolderId);
      assert.equal(metadata.data.name, expected.customerName, "Unexpected customer folder name.");
      assert.equal(metadata.data.mimeType, "application/vnd.google-apps.folder");
      assert.equal(metadata.data.trashed, false, "Customer folder is trashed or its state is unknown.");
      assert.equal(metadata.data.capabilities?.canAddChildren, true, "Folder write capability is not confirmed.");
      assert(
        metadata.data.parents?.includes(customersFolderId),
        "Customer folder has an unexpected parent.",
      );
      const listing = await drive.files.list({
        q: `'${expected.driveFolderId}' in parents and trashed=false`,
        fields: "nextPageToken,incompleteSearch,files(id,name,mimeType,size)",
        pageSize: 10,
      }, { retry: false });
      assert(!listing.data.incompleteSearch && !listing.data.nextPageToken, "Incomplete folder listing. STOP.");
      const files = listing.data.files;
      assert(files, "Drive omitted the folder listing.");
      assert.equal(
        files.length,
        expectedPdfCount,
        "Unexpected existing/missing files. Do not retry, delete, or replace anything; inspect manually.",
      );
      const ids = new Set<string>();
      for (let index = 0; index < expectedPdfCount; index += 1) {
        const name = `${initial.show.name} - Ticket ${index + 1}.pdf`;
        const matches: typeof files = files.filter((file) => file.name === name);
        assert.equal(matches.length, 1, `Expected exactly one PDF named ${name}.`);
        const file = matches[0];
        assert(file.id && !ids.has(file.id), "Missing or duplicate PDF file ID.");
        assert.equal(file.mimeType, "application/pdf", "Unexpected file type.");
        assert(file.size && Number(file.size) > 0, "PDF size is missing or empty.");
        ids.add(file.id);
      }
      return files.map((file) => ({ id: file.id, name: file.name }));
    };

    const revalidate = async () => {
      const current = await readOnly(validateDatabase);
      assert.equal(current.show.name, initial.show.name, "Show name changed during execution.");
      assert.equal(current.show.date?.getTime(), initial.show.date?.getTime(), "Show date changed during execution.");
      for (const key of ["driveFolderId", "driveCustomersFolderId", "driveVideosFolderId"] as const) {
        assert.equal(current.reservation.performance[key], initial.reservation.performance[key]);
      }
      assert.deepEqual(
        current.reservation.ticketOrders.map((ticket) => ticket.id),
        initial.reservation.ticketOrders.map((ticket) => ticket.id),
        "Ticket numbering order changed during execution.",
      );
    };

    phase = "read-only pre-upload Drive inspection";
    await inspectFolder(0);
    for (let index = 0; index < initial.reservation.ticketOrders.length; index += 1) {
      const ticket = initial.reservation.ticketOrders[index];
      phase = `pre-upload validation for existing ticket ${ticket.id}`;
      await revalidate();
      await inspectFolder(index);
      phase = `asset generation/upload for existing ticket ${ticket.id}`;
      externalActionsStarted = true;
      await generateTicketAssets(ticket.id);
      phase = `post-upload inspection for existing ticket ${ticket.id}`;
      await inspectFolder(index + 1);
    }

    phase = "final pre-email validation";
    await revalidate();
    const pdfs = await inspectFolder(expected.quantity);
    console.log("Verified uploaded PDFs:", JSON.stringify(pdfs));
    phase = "SendGrid submission (failure may have an ambiguous outcome)";
    await sendGenerationsTicketConfirmation({
      order: {
        firstName: "Kathleen",
        lastName: "O'Mara",
        email: expected.email,
        performanceName: expected.performanceName,
        total: expected.totalAmount,
        shows: [{ name: initial.show.name, quantity: expected.quantity }],
      },
      driveFolderLink: folderLink,
    });
    emailAccepted = true;

    phase = "recording SendGrid acceptance";
    const ticketsSentAt = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Reservation" WHERE id = ${expected.reservationId} FOR UPDATE NOWAIT`;
      await validateDatabase(tx);
      const updated = await tx.reservation.update({
        where: { id: expected.reservationId },
        data: { ticketsSentAt: new Date() },
      });
      return updated.ticketsSentAt;
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 30000 });
    console.log(JSON.stringify({
      result: "Two existing tickets fulfilled; SendGrid accepted the email, not proof of inbox delivery.",
      reservationId: expected.reservationId,
      ticketIds: expected.tickets.map((ticket) => ticket.id),
      pdfs,
      email: expected.email,
      ticketsSentAt,
    }, null, 2));
  } catch (error) {
    console.error(`STOPPED during ${phase}. No automatic retry, deletion, or cleanup was attempted.`);
    if (externalActionsStarted) {
      console.error("Execution may be partial. Do not rerun --execute; manually inspect Drive/database/SendGrid.");
    }
    if (emailAccepted) {
      console.error("SendGrid already accepted the email. Do not send it again, even if timestamp recording failed.");
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
