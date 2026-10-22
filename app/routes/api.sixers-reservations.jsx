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
    } = body;

    const ticketQuantity = Number(quantity);

    if (!["FW", "PM"].includes(account)) {
      return Response.json(
        { error: "Please select a valid studio." },
        { status: 400 },
      );
    }

    if (
      !Number.isSafeInteger(ticketQuantity) ||
      ticketQuantity < 1
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

      const remaining =
        tier.capacity - (reserved._sum.quantity || 0);

      if (ticketQuantity > remaining) {
        throw new Error(
          `Only ${Math.max(0, remaining)} tickets remain at this price.`,
        );
      }

      const reservation = await tx.eventReservation.create({
        data: {
          eventLocationId: location.id,
          ticketTierId: tier.id,
          customerName: `${firstName.trim()} ${lastName.trim()}`,
          customerEmail: email.trim(),
          quantity: ticketQuantity,
          paymentMethod: "CREDIT_CARD",
          status: "PENDING",
          totalAmount: Number(
            (ticketQuantity * tier.price * 1.026).toFixed(2),
          ),
        },
      });

      return {
        reservationId: reservation.id,
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
