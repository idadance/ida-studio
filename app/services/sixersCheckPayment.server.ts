import prisma from "../db.server";

import { safelyResolveSixersPaymentReview } from "./sixersPaymentReview.server";

import { reconcileSixersPaidCheck } from "./sixersCheckReconciliation.server";

export function isSixersCheckPaymentsEnabled() {
  return process.env.ENABLE_SIXERS_CHECK_PAYMENTS === "true";
}

export async function claimSixersCheckProcessing({
  reservationId,
  expectedDraftOrderId,
  prismaClient = prisma,
}: {
  reservationId: string;
  expectedDraftOrderId?: string | null;
  prismaClient?: typeof prisma;
}) {
  const claim = await prismaClient.eventReservation.updateMany({
    where: {
      id: reservationId,
      status: "PENDING",
      paymentMethod: "CHECK",
      shopifyDraftStatus: { in: ["CREATED", "PROCESSING"] },
      ...(expectedDraftOrderId
        ? { shopifyDraftOrderId: expectedDraftOrderId }
        : {}),
    },
    data: {
      shopifyDraftStatus: "PROCESSING",
    },
  });

  return claim.count === 1;
}

export async function confirmSixersCheckReservation({
  reservationId,
  shopifyOrder,
  checkNumber,
  prismaClient = prisma,
}: {
  reservationId: string;
  shopifyOrder: {
    id: string;
    name: string;
    displayFinancialStatus?: string;
  };
  checkNumber?: string;
  prismaClient?: typeof prisma;
}) {
  const reservation = await prismaClient.eventReservation.findUnique({
    where: { id: reservationId },
    include: {
      eventLocation: true,
      ticketTier: { include: { event: true } },
    },
  });

  if (!reservation) {
    throw new Error("Sixers reservation not found during recovery.");
  }

  if (reservation.status === "CONFIRMED") {
    const existingOrderId = reservation.shopifyOrderId;
    const incomingOrderId = shopifyOrder.id.split("/").pop();

    if (existingOrderId === incomingOrderId) {
      return {
        success: true,
        alreadyConfirmed: true,
        reservationId: reservation.id,
        shopifyOrderNumber: reservation.shopifyOrderNumber,
      };
    }

    throw new Error(
      "This reservation is already confirmed with a different Shopify order. Manual review required."
    );
  }

  if (reservation.status !== "PENDING") {
    throw new Error(
      "This Sixers reservation is not awaiting payment and cannot be confirmed."
    );
  }

  const confirmation = await prismaClient.eventReservation.updateMany({
    where: {
      id: reservationId,
      status: { in: ["PENDING", "PROCESSING"] },
      paymentMethod: "CHECK",
      shopifyDraftOrderId: reservation.shopifyDraftOrderId,
    },
    data: {
      status: "CONFIRMED",
      checkNumber: checkNumber?.trim() || reservation.checkNumber || null,
      checkReceivedAt: reservation.checkReceivedAt ?? new Date(),
      shopifyOrderId: shopifyOrder.id.split("/").pop(),
      shopifyOrderNumber: shopifyOrder.name,
      shopifyDraftStatus: "COMPLETED",
    },
  });

  if (confirmation.count !== 1) {
    const latest = await prismaClient.eventReservation.findUnique({
      where: { id: reservationId },
    });

    if (
      latest?.status === "CONFIRMED" &&
      latest.shopifyOrderId === shopifyOrder.id.split("/").pop()
    ) {
      return {
        success: true,
        alreadyConfirmed: true,
        reservationId: latest.id,
        shopifyOrderNumber: latest.shopifyOrderNumber,
      };
    }

    throw new Error(
      "The reservation changed during confirmation. Manual review required."
    );
  }

  return {
    success: true,
    alreadyConfirmed: false,
    reservationId: reservation.id,
    shopifyOrderNumber: shopifyOrder.name,
  };
}

export async function recoverSixersCheckProcessing({
  reservationId,
  account,
  admin,
  prismaClient = prisma,
}: {
  reservationId: string;
  account: "FW" | "PM";
  admin: any;
  prismaClient?: typeof prisma;
}) {
  const reservation = await prismaClient.eventReservation.findUnique({
    where: { id: reservationId },
    include: {
      eventLocation: true,
      ticketTier: { include: { event: true } },
    },
  });

  if (!reservation) {
    throw new Error("Sixers reservation not found during recovery.");
  }

  if (
    reservation.paymentMethod !== "CHECK" ||
    reservation.ticketTier?.event.type !== "TICKET_SALE" ||
    reservation.eventLocation.studioCode !== account
  ) {
    throw new Error("Invalid Sixers check reservation recovery target.");
  }

  if (!reservation.shopifyDraftOrderId?.startsWith("gid://shopify/DraftOrder/")) {
    throw new Error(
      "The Shopify draft order needs review before recovery can proceed."
    );
  }

  const response = await admin.graphql(
    `#graphql
      query SixersDraftOrderRecovery($id: ID!) {
        draftOrder(id: $id) {
          id
          status
          totalPrice
          order {
            id
            name
            displayFinancialStatus
          }
          customAttributes {
            key
            value
          }
          lineItems(first: 25) {
            nodes {
              quantity
              variant {
                id
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: reservation.shopifyDraftOrderId,
      },
    }
  );

  const json = await response.json();
  const draft = json.data?.draftOrder;

  if (json.errors?.length || !draft) {
    throw new Error("Unable to verify the Shopify draft order during recovery.");
  }

  const reservationAttribute = draft.customAttributes?.find(
    (attribute: { key: string; value: string }) =>
      attribute.key === "Sixers Reservation ID"
  );

  if (reservationAttribute?.value !== reservation.id) {
    throw new Error(
      "The Shopify draft order does not match this Sixers reservation during recovery."
    );
  }

  const expectedVariantId =
    account === "FW"
      ? reservation.ticketTier.fwCheckVariantId
      : reservation.ticketTier.pmCheckVariantId;

  const items = draft.lineItems?.nodes || [];

  if (
    !expectedVariantId ||
    items.length !== 1 ||
    items[0].variant?.id !==
      `gid://shopify/ProductVariant/${expectedVariantId}` ||
    items[0].quantity !== reservation.quantity
  ) {
    throw new Error(
      "The Shopify ticket variant or quantity does not match this reservation during recovery."
    );
  }

  const expectedCents = Math.round(reservation.totalAmount * 100);
  const shopifyCents = Math.round(Number(draft.totalPrice) * 100);

  if (!Number.isFinite(shopifyCents) || shopifyCents !== expectedCents) {
    throw new Error(
      `Shopify total does not match the Sixers reservation. Expected $${(
        expectedCents / 100
      ).toFixed(2)}, Shopify shows $${Number(draft.totalPrice).toFixed(2)}.`
    );
  }

  if (draft.status !== "OPEN") {
    if (draft.order?.id && draft.order.displayFinancialStatus === "PAID") {
      return reconcileSixersPaidCheck({
        reservationId: reservation.id,
        shop:
          account === "FW"
            ? "ida-dance-store.myshopify.com"
            : "ida-dance-store-pm.myshopify.com",
        shopifyOrderId: draft.order.id,
        shopifyOrderNumber: draft.order.name,
        checkNumber: reservation.checkNumber || undefined,
        admin,
      });
    }

    throw new Error(
      "This Shopify draft is no longer open. Manual review required."
    );
  }

  const claimed = await claimSixersCheckProcessing({
    reservationId: reservation.id,
    expectedDraftOrderId: reservation.shopifyDraftOrderId,
    prismaClient,
  });

  if (!claimed) {
    throw new Error(
      "This Sixers check is already being processed or needs review. Do not retry it again."
    );
  }

  const completionResponse = await admin.graphql(
    `#graphql
      mutation CompleteSixersDraftRecovery($id: ID!) {
        draftOrderComplete(id: $id, paymentPending: false) {
          draftOrder {
            id
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
        id: reservation.shopifyDraftOrderId,
      },
    }
  );

  const completionJson = await completionResponse.json();

  if (completionJson.errors?.length) {
    throw new Error(
      "Shopify could not verify the completed Sixers order during recovery. Manual review required."
    );
  }

  const result = completionJson.data?.draftOrderComplete;

  if (!result || result.userErrors?.length) {
    throw new Error("Shopify draft completion needs manual review during recovery.");
  }

  const paidOrder = result.draftOrder?.order;

  if (!paidOrder?.id || paidOrder.displayFinancialStatus !== "PAID") {
    throw new Error(
      "Shopify did not confirm a paid order during recovery. Manual review required."
    );
  }

  const confirmed = await confirmSixersCheckReservation({
    reservationId: reservation.id,
    shopifyOrder: paidOrder,
    checkNumber: reservation.checkNumber || undefined,
    prismaClient,
  });

  await safelyResolveSixersPaymentReview({
    shop:
      account === "FW"
        ? "ida-dance-store.myshopify.com"
        : "ida-dance-store-pm.myshopify.com",
    shopifyOrderId: paidOrder.id.split("/").pop()!,
    reservationId: reservation.id,
    notes: `Recovery confirmed check payment for Shopify order ${paidOrder.name}.`,
  });

  return confirmed;
}

export async function processSixersCheckReceipt({
  reservationId,
  checkNumber,
  account,
  admin,
  prismaClient = prisma,
}: {
  reservationId: string;
  checkNumber: string;
  account: "FW" | "PM";
  admin: any;
  prismaClient?: typeof prisma;
}) {
  const reservation = await prismaClient.eventReservation.findUnique({
    where: { id: reservationId },
    include: {
      eventLocation: true,
      ticketTier: { include: { event: true } },
    },
  });

  if (
    !reservation ||
    reservation.ticketTier?.event.type !== "TICKET_SALE" ||
    reservation.eventLocation.studioCode !== account ||
    reservation.paymentMethod !== "CHECK"
  ) {
    throw new Error("Invalid Sixers check reservation.");
  }

  if (reservation.status !== "PENDING") {
    throw new Error("This reservation is not awaiting payment.");
  }

  if (
    !["CREATED", "PROCESSING"].includes(
      reservation.shopifyDraftStatus || ""
    ) ||
    !reservation.shopifyDraftOrderId?.startsWith(
      "gid://shopify/DraftOrder/"
    )
  ) {
    throw new Error(
      "The Shopify draft order needs review before receiving payment."
    );
  }

  if (!checkNumber.trim()) {
    throw new Error("Please enter the check number.");
  }

  const response = await admin.graphql(
    `#graphql
      query SixersDraftOrder($id: ID!) {
        draftOrder(id: $id) {
          id
          name
          status
          totalPrice
          order {
            id
            name
            displayFinancialStatus
          }
          customAttributes {
            key
            value
          }
          lineItems(first: 25) {
            nodes {
              quantity
              variant {
                id
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: reservation.shopifyDraftOrderId,
      },
    }
  );

  const json = await response.json();

  if (json.errors?.length || !json.data?.draftOrder) {
    throw new Error("Unable to verify the Shopify draft order.");
  }

  const draft = json.data.draftOrder;

  const reservationAttribute = draft.customAttributes?.find(
    (attribute: { key: string; value: string }) =>
      attribute.key === "Sixers Reservation ID"
  );

  if (reservationAttribute?.value !== reservation.id) {
    throw new Error(
      "The Shopify draft order does not match this Sixers reservation."
    );
  }

  const expectedVariantId =
    account === "FW"
      ? reservation.ticketTier.fwCheckVariantId
      : reservation.ticketTier.pmCheckVariantId;

  const items = draft.lineItems?.nodes || [];

  if (
    !expectedVariantId ||
    items.length !== 1 ||
    items[0].variant?.id !==
      `gid://shopify/ProductVariant/${expectedVariantId}` ||
    items[0].quantity !== reservation.quantity
  ) {
    throw new Error(
      "The Shopify ticket variant or quantity does not match this reservation."
    );
  }

  const expectedCents = Math.round(reservation.totalAmount * 100);
  const shopifyCents = Math.round(Number(draft.totalPrice) * 100);

  if (!Number.isFinite(shopifyCents) || shopifyCents !== expectedCents) {
    throw new Error(
      `Shopify total does not match the Sixers reservation. Expected ${(expectedCents / 100).toFixed(2)}, Shopify shows ${Number(draft.totalPrice).toFixed(2)}.`
    );
  }

  if (draft.status !== "OPEN") {
    if (draft.order?.id && draft.order.displayFinancialStatus === "PAID") {
      if (
        reservation.shopifyOrderId &&
        reservation.shopifyOrderId !== draft.order.id.split("/").pop()
      ) {
        throw new Error(
          "This reservation is linked to a different Shopify order. Manual review required."
        );
      }

      return reconcileSixersPaidCheck({
        reservationId: reservation.id,
        shop:
          account === "FW"
            ? "ida-dance-store.myshopify.com"
            : "ida-dance-store-pm.myshopify.com",
        shopifyOrderId: draft.order.id,
        shopifyOrderNumber: draft.order.name,
        checkNumber: checkNumber.trim(),
        admin,
      });
    }

    throw new Error(
      "This Shopify draft is no longer open. Manual review required."
    );
  }

  if (reservation.shopifyDraftStatus === "PROCESSING") {
    throw new Error(
      "This check was previously being processed, but Shopify still shows the draft as OPEN. Manual review is required before retrying."
    );
  }

  const claim = await prismaClient.eventReservation.updateMany({
    where: {
      id: reservation.id,
      status: "PENDING",
      paymentMethod: "CHECK",
      shopifyDraftStatus: "CREATED",
      shopifyDraftOrderId: reservation.shopifyDraftOrderId,
    },
    data: {
      shopifyDraftStatus: "PROCESSING",
    },
  });

  if (claim.count !== 1) {
    throw new Error(
      "This check is already being processed or needs review. Do not process it again."
    );
  }

  const completionResponse = await admin.graphql(
    `#graphql
      mutation CompleteSixersDraft($id: ID!) {
        draftOrderComplete(id: $id, paymentPending: false) {
          draftOrder {
            id
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
        id: reservation.shopifyDraftOrderId,
      },
    }
  );

  const completionJson = await completionResponse.json();

  if (completionJson.errors?.length) {
    throw new Error(
      "Shopify could not verify the completed Sixers order. Manual review required."
    );
  }

  const result = completionJson.data?.draftOrderComplete;

  if (!result || result.userErrors?.length) {
    throw new Error(
      "Shopify draft completion needs manual review."
    );
  }

  const paidOrder = result.draftOrder?.order;

  if (!paidOrder?.id || paidOrder.displayFinancialStatus !== "PAID") {
    throw new Error(
      "Shopify did not confirm a paid order. Manual review required."
    );
  }

  const confirmation = await prismaClient.eventReservation.updateMany({
    where: {
      id: reservation.id,
      status: "PENDING",
      paymentMethod: "CHECK",
      shopifyDraftOrderId: reservation.shopifyDraftOrderId,
    },
    data: {
      status: "CONFIRMED",
      checkNumber: checkNumber.trim(),
      checkReceivedAt: new Date(),
      shopifyOrderId: paidOrder.id.split("/").pop(),
      shopifyOrderNumber: paidOrder.name,
      shopifyDraftStatus: "COMPLETED",
    },
  });

  if (confirmation.count !== 1) {
    throw new Error(
      "Shopify payment was completed, but the reservation needs manual reconciliation. Do not process the check again."
    );
  }

  await safelyResolveSixersPaymentReview({
    shop:
      account === "FW"
        ? "ida-dance-store.myshopify.com"
        : "ida-dance-store-pm.myshopify.com",
    shopifyOrderId: paidOrder.id.split("/").pop()!,
    reservationId: reservation.id,
    notes: `Check received and reservation confirmed against Shopify order ${paidOrder.name}.`,
  });

  return {
    success: true,
    reservationId: reservation.id,
    shopifyOrderNumber: paidOrder.name,
  };
}

export async function receiveSixersCheck({
  reservationId,
  checkNumber,
  account,
  admin,
}: {
  reservationId: string;
  checkNumber: string;
  account: "FW" | "PM";
  admin: any;
}) {
  const reservation = await prisma.eventReservation.findUnique({
    where: { id: reservationId },
    include: {
      eventLocation: true,
      ticketTier: { include: { event: true } },
    },
  });

  if (
    !reservation ||
    reservation.ticketTier?.event.type !== "TICKET_SALE" ||
    reservation.eventLocation.studioCode !== account ||
    reservation.paymentMethod !== "CHECK"
  ) {
    throw new Error("Invalid Sixers check reservation.");
  }

  if (reservation.status !== "PENDING") {
    throw new Error("This reservation is not awaiting payment.");
  }

  if (
    !["CREATED", "PROCESSING"].includes(
      reservation.shopifyDraftStatus || ""
    ) ||
    !reservation.shopifyDraftOrderId?.startsWith(
      "gid://shopify/DraftOrder/"
    )
  ) {
    throw new Error(
      "The Shopify draft order needs review before receiving payment."
    );
  }

  if (!checkNumber.trim()) {
    throw new Error("Please enter the check number.");
  }

  if (!isSixersCheckPaymentsEnabled()) {
    throw new Error(
      "Sixers check receipt is not enabled yet. No Shopify payment was processed."
    );
  }

  return processSixersCheckReceipt({
    reservationId: reservation.id,
    checkNumber,
    account,
    admin,
  });
}