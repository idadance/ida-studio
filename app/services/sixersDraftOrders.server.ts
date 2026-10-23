import prisma from "../db.server";
import type { Prisma } from "@prisma/client";

export async function createSixersDraftOrder(
  admin: any,
  order: any,
) {
  if (!["FW", "PM"].includes(order.account)) {
    throw new Error("Please select a valid studio.");
  }

  if (
    !order.ticketTierId ||
    typeof order.ticketTierId !== "string"
  ) {
    throw new Error("Please select a ticket tier.");
  }

  const quantity = Number(order.quantity);

  if (
  !Number.isSafeInteger(quantity) ||
  quantity < 1 ||
  quantity > 20
) {
    throw new Error("Please select a valid ticket quantity.");
  }

  const firstName = String(order.firstName || "").trim();
  const lastName = String(order.lastName || "").trim();
  const email = String(order.email || "").trim();

  if (!firstName || !lastName || !email) {
    throw new Error("Please enter your name and email.");
  }

  const checkoutRequestId =
    String(order.checkoutRequestId || "").trim();

  if (
    !checkoutRequestId ||
    checkoutRequestId.length > 128
  ) {
    throw new Error("Missing valid checkout request ID.");
  }

   // SAFETY: Sixers check checkout remains disabled during development.
  throw new Error("Sixers check checkout is not available yet.");

  // Reserve tickets using a shared inventory lock.
  const reservation = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "EventTicketTier"
        WHERE "id" = ${order.ticketTierId}
        FOR UPDATE
      `;

      const existing = await tx.eventReservation.findUnique({
        where: { checkoutRequestId },
      });

            if (existing) {
        if (
          existing.ticketTierId !== order.ticketTierId ||
                    !(await tx.eventLocation.findFirst({
            where: {
              id: existing.eventLocationId,
              studioCode: order.account,
            },
          })) ||
          existing.quantity !== quantity ||
          existing.paymentMethod !== "CHECK" ||
          existing.customerEmail !== email
        ) {
          throw new Error(
            "This checkout request ID was already used for a different order.",
          );
        }

        throw new Error("This checkout request has already been received. Please contact IDA before trying again.");
      }

      const tier = await tx.eventTicketTier.findUnique({
        where: { id: order.ticketTierId },
        include: {
          event: {
            include: { locations: true },
          },
        },
      });

      if (
        !tier ||
        tier.event.type !== "TICKET_SALE" ||
        tier.event.status !== "PUBLISHED" ||
        !tier.event.checkEnabled
      ) {
        throw new Error(
          "This ticket sale is not available for check payment.",
        );
      }

      const location = tier.event.locations.find(
        (item: { studioCode: string }) => item.studioCode === order.account,
      );

      if (!location) {
        throw new Error("The selected studio is unavailable.");
      }

            const configuredVariantId =
        order.account === "FW"
          ? tier.fwCheckVariantId
          : tier.pmCheckVariantId;

      if (!configuredVariantId) {
        throw new Error(
          "Shopify check payment is not configured for this ticket price.",
        );
      }

      const reserved = await tx.eventReservation.aggregate({
        where: {
          ticketTierId: tier.id,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        _sum: { quantity: true },
      });

      const remaining =
        tier.capacity - (reserved._sum.quantity || 0);

      if (quantity > remaining) {
        throw new Error(
          `Only ${Math.max(0, remaining)} tickets remain in this tier.`,
        );
      }

      return tx.eventReservation.create({
        data: {
          eventLocationId: location.id,
          ticketTierId: tier.id,
          checkoutRequestId,
          shopifyDraftStatus: "CREATING",
          customerName: `${firstName} ${lastName}`,
          customerEmail: email,
          quantity,
          paymentMethod: "CHECK",
          status: "PENDING",
          totalAmount: Number(
            (tier.price * quantity).toFixed(2),
          ),
        },
      });
    },
  );

  const tierForShopify = await prisma.eventTicketTier.findUnique({
    where: { id: reservation.ticketTierId! },
  });

  if (!tierForShopify) {
    throw new Error("The selected ticket tier was not found.");
  }

  const variantId =
    order.account === "FW"
      ? tierForShopify.fwCheckVariantId
      : tierForShopify.pmCheckVariantId;

  if (!variantId) {
    throw new Error(
      "The check-payment product is not configured for this ticket tier.",
    );
  }

  let createdDraftOrder: any;

  try {
    const response = await admin.graphql(
      `#graphql
        mutation DraftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
              name
              invoiceUrl
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
          input: {
            lineItems: [
              {
                variantId: `gid://shopify/ProductVariant/${variantId}`,
                quantity,
              },
            ],
            email,
            tags: [
              "Sixers Ticket Sale",
              "Check Payment",
              order.account === "FW"
                ? "Fort Washington"
                : "Plymouth Meeting",
            ],
            customAttributes: [
              {
                key: "Sixers Reservation ID",
                value: reservation.id,
              },
              {
                key: "Checkout Request ID",
                value: checkoutRequestId,
              },
              {
                key: "Ticket Tier",
                value: tierForShopify.name,
              },
              {
                key: "Ticket Quantity",
                value: String(quantity),
              },
              {
                key: "Studio",
                value: order.account,
              },
              {
                key: "Payment Method",
                value: "Check",
              },
            ],
            note:
              `Sixers Ticket Sale\n` +
              `Reservation: ${reservation.id}\n` +
              `Customer: ${firstName} ${lastName}\n` +
              `Email: ${email}\n` +
              `Tier: ${tierForShopify.name}\n` +
              `Quantity: ${quantity}\n` +
              `Studio: ${order.account}\n` +
              `Payment Method: Check`,
          },
        },
      },
    );

    const json = await response.json();

    if (json.errors?.length) {
      throw new Error(
        `Shopify draft order error: ${JSON.stringify(json.errors)}`,
      );
    }

    const shopifyResult = json.data?.draftOrderCreate;

    if (!shopifyResult) {
      throw new Error("Shopify returned no draft order result.");
    }

    if (shopifyResult.userErrors?.length) {
      throw new Error(
        shopifyResult.userErrors
          .map((error: any) => error.message)
          .join(", "),
      );
    }

    if (!shopifyResult.draftOrder?.id) {
      throw new Error("Shopify did not create the draft order.");
    }

    createdDraftOrder = shopifyResult.draftOrder;

    await prisma.eventReservation.update({
  where: { id: reservation.id },
  data: {
    shopifyDraftOrderId: shopifyResult.draftOrder.id,
    shopifyOrderNumber: shopifyResult.draftOrder.name,
    shopifyDraftStatus: "CREATED",
  },
});

  } catch (error) {
    await prisma.eventReservation.update({
      where: { id: reservation.id },
      data: { shopifyDraftStatus: "NEEDS_REVIEW" },
    }).catch((updateError: unknown) => {
      console.error("Unable to flag Sixers reservation for review:", reservation.id, updateError);
    });

    console.error("Sixers Shopify draft-order error:", reservation.id, error);

    throw new Error(
      "We could not verify your check reservation. Please contact IDA before trying again.",
    );
  }

  return {
    success: true,
    reservationId: reservation.id,
    draftOrderId: createdDraftOrder.id,
    draftOrderName: createdDraftOrder.name,
    invoiceUrl: createdDraftOrder.invoiceUrl,
  };
}
