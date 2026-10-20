import prisma from "../db.server";

import {
  capturePayPalOrder,
  getPayPalOrder,
} from "../services/paypal.server";

import {
  createReservation,
  createTicketOrders,
} from "../services/ticketOrders.server";

import {
  prepareCustomerFolder,
} from "../services/googleDrive.server";

import {
  sendGenerationsTicketConfirmation,
} from "../services/email.server";

export async function action({
  request,
}: {
  request: Request;
}) {
  if (request.method !== "POST") {
    return Response.json(
      {
        error: "Method not allowed.",
      },
      {
        status: 405,
      },
    );
  }

  try {
    const body = await request.json();

    const paypalOrderId =
      typeof body.paypalOrderId === "string"
        ? body.paypalOrderId.trim()
        : "";

    const showId =
      typeof body.showId === "string"
        ? body.showId.trim()
        : "";

    const quantity = Number(body.quantity);

    const firstName =
      typeof body.firstName === "string"
        ? body.firstName.trim()
        : "";

    const lastName =
      typeof body.lastName === "string"
        ? body.lastName.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (
      !paypalOrderId ||
      !showId ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !firstName ||
      !lastName ||
      !email
    ) {
      return Response.json(
        {
          error:
            "Missing or invalid ticket information.",
        },
        {
          status: 400,
        },
      );
    }

    // ======================================
    // PayPal capture idempotency
    //
    // If the browser retries after we have
    // already created the reservation, return
    // that reservation instead of charging or
    // creating tickets again.
    // ======================================

    const existingReservation =
      await prisma.reservation.findUnique({
        where: {
          paypalOrderId,
        },
      });

    if (existingReservation) {
      return Response.json({
        success: true,
        reservationId:
          existingReservation.id,
        reservation:
          existingReservation,
        alreadyProcessed: true,
      });
    }

    // ======================================
    // Load authoritative show information
    // ======================================

    const now = new Date();

    const show =
      await prisma.show.findUnique({
        where: {
          id: showId,
        },

        include: {
          performance: true,

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
                gt: now,
              },
            },
          },
        },
      });

    if (!show) {
      return Response.json(
        {
          error: "Show not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      show.performance.organization !==
      "GENERATIONS"
    ) {
      return Response.json(
        {
          error:
            "This show is not a Generations performance.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      show.performance.status !== "PUBLISHED"
    ) {
      return Response.json(
        {
          error:
            "Ticket sales are not available for this performance.",
        },
        {
          status: 400,
        },
      );
    }

    if (!show.boxOffice?.salesOpen) {
      return Response.json(
        {
          error:
            "Ticket sales are currently closed.",
        },
        {
          status: 400,
        },
      );
    }

    // ======================================
    // Enforce ticket limit
    // ======================================

    if (
      show.boxOffice.ticketLimitEnabled &&
      show.boxOffice.ticketLimit &&
      quantity > show.boxOffice.ticketLimit
    ) {
      return Response.json(
        {
          error: `The ticket limit is ${show.boxOffice.ticketLimit}.`,
        },
        {
          status: 400,
        },
      );
    }

    // ======================================
    // Re-check capacity immediately before
    // capturing the PayPal payment.
    // ======================================

    const reservedSeats =
      show.ticketOrders.reduce(
        (
          total: number,
          order: { quantity: number },
        ) => total + order.quantity,
        0,
      );

    const heldWaitlistSeats =
      show.waitlistEntries.reduce(
        (
          total: number,
          entry: { quantity: number },
        ) => total + entry.quantity,
        0,
      );

    const remainingSeats = Math.max(
      0,
      show.boxOffice.capacity -
        reservedSeats -
        heldWaitlistSeats,
    );

    if (quantity > remainingSeats) {
      return Response.json(
        {
          error:
            remainingSeats === 0
              ? "This show is sold out."
              : `Only ${remainingSeats} ticket${
                  remainingSeats === 1
                    ? ""
                    : "s"
                } remain.`,
        },
        {
          status: 409,
        },
      );
    }

    // ======================================
    // Calculate authoritative total
    // ======================================

    const ticketPrice = Number(
      show.boxOffice.ticketPrice,
    );

    const totalAmount =
      ticketPrice * quantity;

    if (
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0
    ) {
      throw new Error(
        "Invalid ticket total.",
      );
    }

    // ======================================
    // Capture PayPal payment
    // ======================================

    let paypalCapture;

try {
  paypalCapture =
    await capturePayPalOrder(
      paypalOrderId,
    );
} catch (captureError) {
  // The payment may already have been captured
  // successfully on an earlier attempt where
  // our local reservation creation later failed.
  // Retrieve the PayPal order so we can verify
  // the existing capture without charging again.
  console.warn(
    "PayPal capture call failed; checking existing order:",
    paypalOrderId,
  );

  paypalCapture =
    await getPayPalOrder(
      paypalOrderId,
    );
}

    const paypalPurchaseUnit =
      paypalCapture?.purchase_units?.[0];

    const paypalCaptureDetails =
      paypalPurchaseUnit
        ?.payments?.captures?.[0];

    const capturedAmount = Number(
      paypalCaptureDetails?.amount?.value,
    );

    const capturedCurrency =
      paypalCaptureDetails?.amount
        ?.currency_code;

    const paypalCaptureId =
      paypalCaptureDetails?.id;

    if (
      paypalCapture?.status !== "COMPLETED" ||
      paypalCaptureDetails?.status !==
        "COMPLETED" ||
      !paypalCaptureId ||
      capturedCurrency !== "USD" ||
      !Number.isFinite(capturedAmount) ||
      Math.abs(
        capturedAmount - totalAmount,
      ) > 0.001
    ) {
      console.error(
        "PayPal capture verification failed:",
        {
          paypalOrderId,
          orderStatus:
            paypalCapture?.status,
          captureStatus:
            paypalCaptureDetails?.status,
          capturedAmount,
          capturedCurrency,
          expectedAmount:
            totalAmount,
        },
      );

      throw new Error(
        "PayPal payment could not be verified.",
      );
    }

    // ======================================
    // Build the same order structure used
    // by the existing ticket engine.
    // ======================================

    const order = {
      firstName,
      lastName,
      email,

      account: "FW",

      performanceId:
        show.performance.id,

      performanceName:
        show.performance.name,

      shows: [
  {
    showId: show.id,
    name: show.name,
    quantity,
    price: ticketPrice,
    ticketPrice,
  },
],

      subtotal: totalAmount,
      fee: 0,
      total: totalAmount,

      video: false,
      videoPrice: 0,
    };

    // ======================================
    // Create confirmed reservation
    // ======================================

    const reservation =
      await createReservation({
        order,

        paymentMethod: "PAYPAL",

        status: "CONFIRMED",

        paypalOrderId,

        paypalCaptureId,
      });

    // ======================================
    // Prepare customer Google Drive folder
    // ======================================

    await prepareCustomerFolder(
      show.performance,
      reservation,
      false,
    );

    // ======================================
    // Create individual tickets + QR/PDF
    // ======================================

    await createTicketOrders({
      order,

      paymentMethod: "PAYPAL",

      status: "CONFIRMED",

      reservationId:
        reservation.id,
    });

    // ======================================
    // Reload reservation to verify that the
    // customer Drive folder was created.
    // ======================================

    const updatedReservation =
      await prisma.reservation.findUnique({
        where: {
          id: reservation.id,
        },
      });

    if (
      !updatedReservation?.driveFolderLink
    ) {
      throw new Error(
        "Customer Google Drive folder link was not created.",
      );
    }

   // ======================================
// Send Generations ticket email
// ======================================

try {
  await sendGenerationsTicketConfirmation({
    order,
    driveFolderLink:
      updatedReservation.driveFolderLink,
  });

  // Only mark tickets as sent after
  // SendGrid successfully accepts the email.
  await prisma.reservation.update({
    where: {
      id: reservation.id,
    },

    data: {
      ticketsSentAt: new Date(),
    },
  });

  console.log(
    `✅ Generations ticket delivery completed for reservation ${reservation.id}`,
  );
} catch (emailError) {
  console.error(
    "⚠️ Generations tickets were created, but ticket email failed:",
    emailError,
  );

  // Do not fail the completed PayPal purchase.
  // ticketsSentAt stays null so the customer
  // can be handled through Ready to Send.
}

    return Response.json({
      success: true,
      reservationId:
        updatedReservation.id,
      reservation:
        updatedReservation,
    });
  } catch (error) {
    console.error(
      "Generations PayPal capture error:",
      error,
    );

    return Response.json(
      {
        error:
          "We could not finish processing your ticket purchase.",
      },
      {
        status: 500,
      },
    );
  }
}