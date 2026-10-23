import prisma from "../db.server";

import { safelyResolveSixersPaymentReview } from "./sixersPaymentReview.server";

import { reconcileSixersPaidCheck } from "./sixersCheckReconciliation.server";

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
    throw new Error(
      "Unable to verify the Shopify draft order."
    );
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

    const expectedCents = Math.round(
    reservation.totalAmount * 100
  );

  const shopifyCents = Math.round(
    Number(draft.totalPrice) * 100
  );

  if (
    !Number.isFinite(shopifyCents) ||
    shopifyCents !== expectedCents
  ) {
    throw new Error(
      `Shopify total does not match the Sixers reservation. Expected $${(
        expectedCents / 100
      ).toFixed(2)}, Shopify shows $${Number(
        draft.totalPrice
      ).toFixed(2)}.`
    );
  }

    if (draft.status !== "OPEN") {
    if (
  draft.order?.id &&
  draft.order.displayFinancialStatus === "PAID"
) {
    if (
    reservation.shopifyOrderId &&
    reservation.shopifyOrderId !== draft.order.id.split("/").pop()
  ) {
    throw new Error(
      "This reservation is linked to a different Shopify order. Manual review required."
    );
  }
  // The draft's reservation ID, variant, quantity, and total
  // have already been verified above.
  // Never call draftOrderComplete again for this order.
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

   // SAFETY LOCK: Do not execute this mutation yet.
  throw new Error(
    "Sixers check receipt is not enabled yet. No Shopify payment was processed."
  );

  // Atomically claim this draft so only one request can process it.
  const claim = await prisma.eventReservation.updateMany({
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

     

  // Prepared for later activation, after recovery and
  // webhook safeguards have been implemented and tested.
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

    // If Shopify completed the order but the response was interrupted,
  // leave the reservation in PROCESSING for verification and recovery.
  // Never automatically retry draftOrderComplete.

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

  if (
    !paidOrder?.id ||
    paidOrder.displayFinancialStatus !== "PAID"
  ) {
    throw new Error(
      "Shopify did not confirm a paid order. Manual review required."
    );
  }

   const confirmation = await prisma.eventReservation.updateMany({
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