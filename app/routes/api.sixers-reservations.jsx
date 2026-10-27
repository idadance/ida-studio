import prisma from "../db.server";


export async function action({ request }) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed." },
      { status: 405 },
    );
  }

  try {
    const body = await request.json();

    const {
      ticketTierId,
      account,
      firstName,
      lastName,
            email,
      quantity,
      checkoutRequestId,
    } = body;

    const ticketQuantity = Number(quantity);

        if (
      typeof checkoutRequestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        checkoutRequestId
      )
    ) {
      return Response.json(
        { error: "Invalid checkout request ID." },
        { status: 400 },
      );
    }

    if (!["FW", "PM"].includes(account)) {
      return Response.json(
        { error: "Please select a valid studio." },
        { status: 400 },
      );
    }

        if (
      !Number.isSafeInteger(ticketQuantity) ||
      ticketQuantity < 1 ||
      ticketQuantity > 2
    ) {
      return Response.json(
        { error: "Please select a valid ticket quantity." },
        { status: 400 },
      );
    }

    if (
      typeof ticketTierId !== "string" ||
      !ticketTierId.trim() ||
      typeof firstName !== "string" ||
      !firstName.trim() ||
      typeof lastName !== "string" ||
      !lastName.trim() ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      return Response.json(
        { error: "Please provide your name, email, and ticket selection." },
        { status: 400 },
      );
    }

            const existingReservation =
      await prisma.eventReservation.findUnique({
        where: { checkoutRequestId },
                include: {
          eventLocation: true,
          ticketTier: {
            include: { event: true },
          },
        },
      });

    if (existingReservation) {
      const sameReservation =
        existingReservation.ticketTierId === ticketTierId &&
        existingReservation.quantity === ticketQuantity &&
        existingReservation.eventLocation?.studioCode === account &&
        existingReservation.customerName ===
          `${firstName.trim()} ${lastName.trim()}` &&
        existingReservation.customerEmail.toLowerCase() ===
          email.trim().toLowerCase() &&
        existingReservation.paymentMethod === "CREDIT_CARD" &&
        existingReservation.status === "PENDING";

      if (!sameReservation) {
        return Response.json(
          {
            error:
              "This checkout request cannot be reused. Please start a new ticket selection.",
          },
          { status: 409 },
        );
      }

            if (
        !existingReservation.ticketTier ||
        existingReservation.ticketTier.event.type !== "TICKET_SALE" ||
        existingReservation.ticketTier.event.status !== "PUBLISHED" ||
        !existingReservation.ticketTier.event.creditCardEnabled
      ) {
        return Response.json(
          {
            error: "This ticket sale is no longer available for checkout.",
          },
          { status: 409 },
        );
      }

            const existingTier = existingReservation.ticketTier;

      const shopifyVariantId =
        account === "FW"
          ? existingTier.fwCreditVariantId
          : existingTier.pmCreditVariantId;

      if (!shopifyVariantId) {
        return Response.json(
          { error: "Shopify checkout is not configured for this ticket price." },
          { status: 409 },
        );
      }

      return Response.json({
        success: true,
        reservationId: existingReservation.id,
        quantity: existingReservation.quantity,
        shopifyVariantId,
        totalAmount: existingReservation.totalAmount,
      });
    }

   

    const result = await prisma.$transaction(async (tx) => {
      const lockedTiers = await tx.$queryRaw`
        SELECT "id"
        FROM "EventTicketTier"
        WHERE "id" = ${ticketTierId}
        FOR UPDATE
      `;

      if (lockedTiers.length !== 1) {
        throw new Error("Ticket price level not found.");
      }

      const tier = await tx.eventTicketTier.findUnique({
        where: { id: ticketTierId },
        include: {
          event: {
            include: {
              locations: true,
            },
          },
        },
      });

      if (
        !tier ||
        tier.event.type !== "TICKET_SALE" ||
        tier.event.status !== "PUBLISHED"
      ) {
        throw new Error("This ticket sale is not available.");
      }

      if (!tier.event.creditCardEnabled) {
        throw new Error("Credit card payment is unavailable.");
      }

      const location = tier.event.locations.find(
        (item) => item.studioCode === account,
      );

      if (!location) {
        throw new Error("Selected studio is unavailable.");
      }

      const shopifyVariantId =
        account === "FW"
          ? tier.fwCreditVariantId
          : tier.pmCreditVariantId;

      if (!shopifyVariantId) {
        throw new Error(
          "Shopify checkout is not configured for this ticket price.",
        );
      }

      const reserved = await tx.eventReservation.aggregate({
        where: {
          ticketTierId,
          status: {
            in: ["PENDING", "CONFIRMED"],
          },
        },
        _sum: {
          quantity: true,
        },
      });

      const adjustmentHolds =
  await tx.sixersReservationAdjustment.aggregate({
    where: {
      newTicketTierId: tier.id,
      status: {
        in: ["PENDING", "INVOICED"],
      },
    },
    _sum: {
      newQuantity: true,
    },
  });

const remaining =
  tier.capacity -
  (reserved._sum.quantity || 0) -
  (adjustmentHolds._sum.newQuantity || 0);

      if (ticketQuantity > remaining) {
        throw new Error(
          `Only ${Math.max(0, remaining)} tickets remain at this price.`,
        );
      }

      const reservation = await tx.eventReservation.create({
        data: {
          eventLocationId: location.id,
          ticketTierId: tier.id,
          checkoutRequestId,
          customerName: `${firstName.trim()} ${lastName.trim()}`,
          customerEmail: email.trim(),
          quantity: ticketQuantity,
          paymentMethod: "CREDIT_CARD",
          status: "PENDING",
          totalAmount:
            ticketQuantity *
            Number((tier.price * 1.026).toFixed(2)),
        },
      });

      return {
        reservationId: reservation.id,
        quantity: reservation.quantity,
        shopifyVariantId,
        totalAmount: reservation.totalAmount,
        remainingTickets: remaining - ticketQuantity,
      };
    });

    return Response.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Sixers reservation error:", error);
        if (error?.code === "P2002") {
      return Response.json(
        {
          error:
            "This checkout request is already being processed. Please try again.",
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reserve tickets.",
      },
      { status: 400 },
    );
  }
}
