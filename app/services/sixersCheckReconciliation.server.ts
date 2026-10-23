import prisma from "../db.server";
import { safelyResolveSixersPaymentReview } from "./sixersPaymentReview.server";

export async function reconcileSixersPaidCheck({
  reservationId,
  shop,
  shopifyOrderId,
  shopifyOrderNumber,
    checkNumber,
  admin,
}: {
  reservationId: string;
  shop: string;
  shopifyOrderId: string;
  shopifyOrderNumber: string;
    checkNumber?: string;
  admin: any;
}) {
  if (
    !reservationId ||
    !shopifyOrderId?.startsWith("gid://shopify/Order/")
  ) {
    throw new Error("Invalid Sixers payment reconciliation details.");
  }

    const reservation = await prisma.eventReservation.findUnique({
    where: { id: reservationId },
    include: {
      eventLocation: true,
      ticketTier: { include: { event: true } },
    },
  });

  if (
    !reservation ||
    reservation.paymentMethod !== "CHECK" ||
    reservation.ticketTier?.event.type !== "TICKET_SALE"
  ) {
    throw new Error("Invalid Sixers check reservation.");
  }

  const expectedShop =
    reservation.eventLocation.studioCode === "FW"
      ? "ida-dance-store.myshopify.com"
      : reservation.eventLocation.studioCode === "PM"
        ? "ida-dance-store-pm.myshopify.com"
        : null;

  if (!expectedShop || shop !== expectedShop) {
    throw new Error(
      "The Shopify store does not match the Sixers reservation."
    );
  }

    const orderResponse = await admin.graphql(
    `#graphql
      query VerifySixersPaidOrder($id: ID!) {
        order(id: $id) {
          id
          name
                    displayFinancialStatus
          currencyCode
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
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
      }
    `,
    {
      variables: {
        id: shopifyOrderId,
      },
    }
  );

  const orderJson = await orderResponse.json();
  const order = orderJson.data?.order;

  if (
    orderJson.errors?.length ||
    !order ||
    order.id !== shopifyOrderId ||
    order.displayFinancialStatus !== "PAID"
  ) {
    throw new Error(
      "Shopify has not verified this Sixers order as PAID."
    );
  }

    const orderReservationId = order.customAttributes?.find(
    (attribute: { key: string; value: string }) =>
      attribute.key === "Sixers Reservation ID"
  )?.value;

  if (orderReservationId !== reservation.id) {
    throw new Error(
      "The paid Shopify order does not match this Sixers reservation. Manual review required."
    );
  }

    const expectedVariantId =
    reservation.eventLocation.studioCode === "FW"
      ? reservation.ticketTier.fwCheckVariantId
      : reservation.ticketTier.pmCheckVariantId;

  const orderItems = order.lineItems?.nodes || [];

  if (
    !expectedVariantId ||
    orderItems.length !== 1 ||
    orderItems[0].variant?.id !==
      `gid://shopify/ProductVariant/${expectedVariantId}` ||
    orderItems[0].quantity !== reservation.quantity
  ) {
    throw new Error(
      "The paid Shopify order's ticket tier or quantity does not match the Sixers reservation. Manual review required."
    );
  }

    const expectedCents = Math.round(
    reservation.totalAmount * 100
  );

  const paidCents = Math.round(
    Number(order.totalPriceSet?.shopMoney?.amount) * 100
  );

  if (
    order.currencyCode !== "USD" ||
    order.totalPriceSet?.shopMoney?.currencyCode !== "USD" ||
    !Number.isFinite(paidCents) ||
    paidCents !== expectedCents
  ) {
    throw new Error(
      "The paid Shopify order amount does not match the Sixers reservation. Manual review required."
    );
  }

    if (reservation.status === "CONFIRMED") {
        if (
      reservation.shopifyOrderId === shopifyOrderId.split("/").pop()
    ) {
      await safelyResolveSixersPaymentReview({
        shop,
        shopifyOrderId: shopifyOrderId.split("/").pop()!,
        reservationId: reservation.id,
        notes: `Verified existing paid Shopify order ${shopifyOrderNumber}. Reservation was already confirmed.`,
      });

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
      "This Sixers reservation is not awaiting payment."
    );
  }

    const verifiedOrderId = order.id.split("/").pop();

  if (!reservation.shopifyDraftOrderId) {
    throw new Error(
      "This reservation has no linked Shopify draft order. Manual review required."
    );
  }

    const draftResponse = await admin.graphql(
    `#graphql
      query VerifySixersSourceDraft($id: ID!) {
        draftOrder(id: $id) {
          id
          order {
            id
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

  const draftJson = await draftResponse.json();

  if (
    draftJson.errors?.length ||
    draftJson.data?.draftOrder?.id !== reservation.shopifyDraftOrderId ||
    draftJson.data?.draftOrder?.order?.id !== order.id
  ) {
    throw new Error(
      "The paid Shopify order is not verified as belonging to this reservation's draft order. Manual review required."
    );
  }

  if (
    !verifiedOrderId ||
    (reservation.shopifyOrderId &&
      reservation.shopifyOrderId !== verifiedOrderId)
  ) {
    throw new Error(
      "This reservation is linked to a different Shopify order. Manual review required."
    );
  }

    // SAFETY LOCK: Confirmation is prepared but not enabled.
  // The final implementation must also resolve payment reviews
  // and handle interrupted webhook processing.
  throw new Error(
    "Sixers check reconciliation is not enabled yet."
  );

  const confirmation = await prisma.eventReservation.updateMany({
    where: {
      id: reservation.id,
      status: "PENDING",
      paymentMethod: "CHECK",
      shopifyOrderId: null,
    },
        data: {
      status: "CONFIRMED",
      shopifyOrderId: shopifyOrderId.split("/").pop(),
            shopifyOrderNumber: order.name,
      checkNumber: checkNumber?.trim() || null,
      checkReceivedAt: new Date(),
            shopifyDraftStatus: "COMPLETED",
    },
  });

    if (confirmation.count !== 1) {
    const latest = await prisma.eventReservation.findUnique({
      where: { id: reservation.id },
    });

    if (
      latest?.status === "CONFIRMED" &&
      latest.shopifyOrderId === verifiedOrderId
    ) {
      return {
        success: true,
        alreadyConfirmed: true,
        reservationId: reservation.id,
        shopifyOrderNumber: latest.shopifyOrderNumber,
      };
    }

    throw new Error(
      "The reservation changed during reconciliation. Manual review required."
    );
  }

      await safelyResolveSixersPaymentReview({
    shop,
    shopifyOrderId: shopifyOrderId.split("/").pop()!,
    reservationId: reservation.id,
    notes: `Reconciled against verified paid Shopify order ${shopifyOrderNumber}.`,
  });

  return {
    success: true,
    alreadyConfirmed: false,
    reservationId: reservation.id,
    shopifyOrderNumber,
  };
}