
import prisma from "../db.server";
import type { Prisma } from "@prisma/client";

type ShopifyPaidOrder = {
  id?: number | string;
  name?: string;
  financial_status?: string;
  currency?: string;
  total_price?: string;
  draft_order_id?: number | string | null;
  tags?: string;
  line_items?: Array<{
    title?: string;
    quantity?: number;
    price?: string;
  }>;
};

async function getCompletedDraftOrder(
  admin: any,
  draftOrderId: string,
) {
  const response = await admin.graphql(
    `#graphql
      query VerifySixersDraftOrder($id: ID!) {
        draftOrder(id: $id) {
          id
          status
          order {
            id
            name
          }
        }
      }
    `,
    {
      variables: {
        id: draftOrderId,
      },
    },
  );

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(
      `Shopify draft verification failed: ${JSON.stringify(json.errors)}`,
    );
  }

  return json.data?.draftOrder ?? null;
}

export async function processSixersAdjustmentPayment({
  shop,
  payload,
  adjustmentId,
  admin,
}: {
  shop: string;
  payload: ShopifyPaidOrder;
  adjustmentId: string;
  admin: any;
}) {
  const account =
    shop === "ida-dance-store.myshopify.com"
      ? "FW"
      : shop === "ida-dance-store-pm.myshopify.com"
        ? "PM"
        : null;

  if (!account) {
    throw new Error("Unknown Shopify store.");
  }

  if (payload.financial_status !== "paid") {
    throw new Error("Shopify order is not paid.");
  }

  if (payload.currency !== "USD") {
    throw new Error("Unexpected payment currency.");
  }

  const shopifyOrderId = payload.id?.toString();

  if (!shopifyOrderId) {
    throw new Error("Missing Shopify order ID.");
  }

  const orderTags =
    typeof payload.tags === "string"
      ? payload.tags.split(",").map((tag) => tag.trim())
      : [];

  if (!orderTags.includes(`SIXERS_ADJ:${adjustmentId}`)) {
    throw new Error("Adjustment order tag is missing.");
  }

    // Read the saved invoice ID before opening a database transaction.
  const invoice = await prisma.sixersReservationAdjustment.findUnique({
    where: { id: adjustmentId },
    select: { shopifyDraftOrderId: true },
  });

  if (!invoice?.shopifyDraftOrderId) {
    throw new Error(
      "Sixers adjustment has no saved Shopify draft invoice.",
    );
  }

  // Verify the actual Shopify order before acquiring database locks.
  const verifiedDraft = await getCompletedDraftOrder(
    admin,
    invoice.shopifyDraftOrderId,
  );

  if (
    verifiedDraft?.id !== invoice.shopifyDraftOrderId ||
    verifiedDraft?.order?.id !==
      `gid://shopify/Order/${shopifyOrderId}`
  ) {
    throw new Error(
      "Paid Shopify order does not match the saved Sixers draft invoice.",
    );
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Lock this adjustment so simultaneous Shopify webhooks
    // cannot create duplicate tickets.
    await tx.$queryRaw`
      SELECT "id"
      FROM "SixersReservationAdjustment"
      WHERE "id" = ${adjustmentId}
      FOR UPDATE
    `;

    const adjustment =
      await tx.sixersReservationAdjustment.findUnique({
        where: { id: adjustmentId },
        include: {
          reservation: {
            include: {
              eventLocation: true,
            },
          },
        },
      });

    if (!adjustment) {
      throw new Error("Sixers adjustment not found.");
    }

    if (
      adjustment.reservation.eventLocation.studioCode !== account
    ) {
      throw new Error(
        "Adjustment belongs to another studio.",
      );
    }

    if (adjustment.status === "PAID") {
      if (
        adjustment.shopifyOrderId === shopifyOrderId ||
        adjustment.shopifyOrderId ===
          `gid://shopify/Order/${shopifyOrderId}`
      ) {
        return {
          status: "ALREADY_PAID",
          adjustmentId,
          resultingReservationId:
            adjustment.resultingReservationId,
        };
      }

      throw new Error(
        "Adjustment was paid by a different Shopify order.",
      );
    }

    if (
  !["INVOICED", "SENDING", "SENT"].includes(
    adjustment.status
  )
) {
      throw new Error(
        `Adjustment is not ready for payment: ${adjustment.status}`,
      );
    }

    if (!adjustment.shopifyDraftOrderId) {
      throw new Error(
        "Adjustment has no saved Shopify draft order.",
      );
    }

       // Ensure the invoice has not changed since Shopify verification.
    if (
      adjustment.shopifyDraftOrderId !== invoice.shopifyDraftOrderId
    ) {
      throw new Error(
        "Sixers draft invoice changed during payment verification.",
      );
    }

    const expectedCents = Math.round(
      adjustment.amountDue * 100,
    );
    const receivedCents = Math.round(
      Number(payload.total_price) * 100,
    );

    if (
      !Number.isFinite(receivedCents) ||
      receivedCents !== expectedCents
    ) {
      throw new Error(
        `Payment mismatch: expected ${expectedCents} cents, received ${receivedCents} cents.`,
      );
    }

    if (
      !Array.isArray(payload.line_items) ||
      payload.line_items.length !== 1 ||
      payload.line_items[0].quantity !== 1 ||
      Math.round(
        Number(payload.line_items[0].price) * 100,
      ) !== expectedCents
    ) {
      throw new Error(
        "Shopify invoice line items do not match.",
      );
    }

    const original = adjustment.reservation;

    if (original.status !== "CONFIRMED") {
      throw new Error(
        "Original reservation is no longer confirmed.",
      );
    }

    if (
      original.quantity !== adjustment.originalQuantity ||
      original.ticketTierId !==
        adjustment.originalTicketTierId
    ) {
      throw new Error(
        "Original reservation changed after adjustment was created.",
      );
    }

    if (
      !Number.isInteger(adjustment.newQuantity) ||
      adjustment.newQuantity <= 0
    ) {
      throw new Error(
        "Invalid adjustment ticket quantity.",
      );
    }

    const targetTier =
      await tx.eventTicketTier.findUnique({
        where: { id: adjustment.newTicketTierId },
      });

    if (!targetTier) {
      throw new Error(
        "Adjustment ticket tier no longer exists.",
      );
    }

    const isUpgrade =
      adjustment.originalTicketTierId !==
      adjustment.newTicketTierId;

    let resultingReservationId: string;

    if (isUpgrade) {
      // Upgrade: move the existing tickets to the new tier.
      // Preserve the original Shopify payment references.
      if (
        adjustment.newQuantity !== original.quantity
      ) {
        throw new Error(
          "Upgrade quantity does not match original reservation.",
        );
      }

      await tx.eventReservation.update({
        where: { id: original.id },
        data: {
          ticketTierId: adjustment.newTicketTierId,
        },
      });

      resultingReservationId = original.id;
    } else {
      // Additional tickets: create a separate confirmed
      // reservation, leaving the original paid order intact.
      const additionalReservation =
        await tx.eventReservation.create({
          data: {
            eventLocationId: original.eventLocationId,
            customerName: original.customerName,
            customerEmail: original.customerEmail,
            quantity: adjustment.newQuantity,
            ticketTierId: adjustment.newTicketTierId,
            paymentMethod: "CREDIT_CARD",
            status: "CONFIRMED",
            totalAmount: adjustment.amountDue,
            shopifyOrderId,
            shopifyOrderNumber: payload.name ?? null,
            notes:
              `Additional Sixers tickets from adjustment ${adjustment.id}; ` +
              `original reservation ${original.id}`,
          },
        });

      resultingReservationId =
        additionalReservation.id;
    }

    // The ticket change and payment record commit together.
    await tx.sixersReservationAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: "PAID",
        shopifyOrderId,
        shopifyOrderNumber: payload.name ?? null,
        resultingReservationId,
      },
    });

    return {
      status: "PAID",
      adjustmentId,
      shopifyOrderId,
      resultingReservationId,
      type: isUpgrade ? "UPGRADE" : "ADDITIONAL_TICKETS",
    };
  });
}
