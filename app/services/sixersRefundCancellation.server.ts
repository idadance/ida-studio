import prisma from "../db.server";

import type { Prisma } from "@prisma/client";

const ACTIVE_ADJUSTMENT_STATUSES = [
  "PENDING",
  "CREATING",
  "INVOICED",
  "SENDING",
  "SENT",
  "PAID",
] as const;

export async function verifySixersRefundCancellationEligibility({
  reservationId,
  account,
}: {
  reservationId: string;
  account: "FW" | "PM";
}) {
  const reservation = await prisma.eventReservation.findUnique({
    where: { id: reservationId },
    include: {
      eventLocation: true,
      ticketTier: true,
    },
  });

  if (
    !reservation ||
    !reservation.ticketTierId ||
    !reservation.ticketTier ||
    reservation.eventLocation.studioCode !== account ||
    reservation.paymentMethod !== "CREDIT_CARD" ||
    reservation.status !== "CONFIRMED" ||
    !reservation.shopifyOrderId ||
    !Number.isSafeInteger(reservation.quantity) ||
    reservation.quantity < 1
  ) {
    throw new Error(
      "This is not an eligible confirmed Sixers credit-card reservation.",
    );
  }

  const adjustment = await prisma.sixersReservationAdjustment.findFirst({
    where: {
      reservationId,
      status: { in: [...ACTIVE_ADJUSTMENT_STATUSES] },
    },
  });

  if (adjustment) {
    throw new Error(
      "This reservation has a ticket adjustment that requires manual review.",
    );
  }

    const openPaymentReview =
    await prisma.sixersPaymentReview.findFirst({
      where: {
        status: "OPEN",
        OR: [
          { reservationId: reservation.id },
          {
            shopifyOrderId: reservation.shopifyOrderId!,
          },
        ],
      },
    });

  if (openPaymentReview) {
    throw new Error(
      "This reservation has an unresolved Shopify payment review. No tickets were canceled.",
    );
  }

  return reservation;
}

export async function verifySixersShopifyRefund({
  admin,
  shop,
  reservationId,
  account,
}: {
  admin: any;
  shop: string;
  reservationId: string;
  account: "FW" | "PM";
}) {
  const reservation =
    await verifySixersRefundCancellationEligibility({
      reservationId,
      account,
    });

  const expectedShop =
    account === "FW"
      ? "ida-dance-store.myshopify.com"
      : "ida-dance-store-pm.myshopify.com";

  if (shop !== expectedShop) {
    throw new Error(
      "The Shopify store does not match this reservation.",
    );
  }

  const shopifyOrderId =
    `gid://shopify/Order/${reservation.shopifyOrderId}`;

  const response = await admin.graphql(
    `#graphql
      query VerifySixersRefund($id: ID!) {
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
          totalRefundedSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
      }
    `,
    {
      variables: { id: shopifyOrderId },
    },
  );

  const result = await response.json();
  const order = result.data?.order;

  if (
    result.errors?.length ||
    !order ||
    order.id !== shopifyOrderId
  ) {
    throw new Error(
      "Shopify could not verify this order. No tickets were canceled.",
    );
  }

    const orderReservationId = order.customAttributes?.find(
    (attribute: { key: string; value: string }) =>
      attribute.key === "Sixers Reservation ID",
  )?.value;

  if (orderReservationId !== reservation.id) {
    throw new Error(
      "Shopify order does not match this Sixers reservation. No tickets were canceled.",
    );
  }

  const expectedVariantId =
    account === "FW"
      ? reservation.ticketTier!.fwCreditVariantId
      : reservation.ticketTier!.pmCreditVariantId;

  const orderItems = order.lineItems?.nodes ?? [];

  if (
    !expectedVariantId ||
    orderItems.length !== 1 ||
    orderItems[0].variant?.id !==
      `gid://shopify/ProductVariant/${expectedVariantId}` ||
    orderItems[0].quantity !== reservation.quantity
  ) {
    throw new Error(
      "Shopify ticket type or quantity does not match this reservation. Manual review required.",
    );
  }

    const toCents = (amount: unknown) => {
    if (
      amount === null ||
      amount === undefined ||
      amount === ""
    ) {
      return NaN;
    }

    const value = Number(amount);

    return Number.isFinite(value)
      ? Math.round(value * 100)
      : NaN;
  };

  const expectedCents = toCents(reservation.totalAmount);

  const orderCents = toCents(
    order.totalPriceSet?.shopMoney?.amount,
  );

  const refundedCents = toCents(
    order.totalRefundedSet?.shopMoney?.amount,
  );

    if (order.displayFinancialStatus !== "REFUNDED") {
    throw new Error(
      `Shopify financial status is ${order.displayFinancialStatus}. A completed refund is required before tickets can be released.`,
    );
  }

  if (
    order.currencyCode !== "USD" ||
    order.totalPriceSet?.shopMoney?.currencyCode !== "USD" ||
    order.totalRefundedSet?.shopMoney?.currencyCode !== "USD" ||
    !Number.isFinite(expectedCents) ||
    !Number.isFinite(orderCents) ||
    !Number.isFinite(refundedCents) ||
    expectedCents <= 0 ||
    orderCents !== expectedCents ||
    refundedCents !== orderCents ||
    order.displayFinancialStatus !== "REFUNDED"
  ) {
    throw new Error(
      "Shopify has not verified a full refund of this Sixers order. No tickets were canceled.",
    );
  }

  return { reservation, order };
}

export async function cancelVerifiedSixersRefund({
  admin,
  shop,
  reservationId,
  account,
}: {
  admin: any;
  shop: string;
  reservationId: string;
  account: "FW" | "PM";
}) {
  // Shopify verification must succeed before any database changes.
  const { reservation } = await verifySixersShopifyRefund({
    admin,
    shop,
    reservationId,
    account,
  });

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Coordinate with ticket adjustments and inventory operations.
    await tx.$queryRaw`
      SELECT "id"
      FROM "EventTicketTier"
      WHERE "id" = ${reservation.ticketTierId}
      FOR UPDATE
    `;

    await tx.$queryRaw`
      SELECT "id"
      FROM "EventReservation"
      WHERE "id" = ${reservationId}
      FOR UPDATE
    `;

    const current = await tx.eventReservation.findUnique({
      where: { id: reservationId },
      include: { eventLocation: true },
    });

    if (
      !current ||
      current.status !== "CONFIRMED" ||
      current.paymentMethod !== "CREDIT_CARD" ||
      current.eventLocation.studioCode !== account ||
      current.ticketTierId !== reservation.ticketTierId ||
      current.quantity !== reservation.quantity ||
      current.totalAmount !== reservation.totalAmount ||
      current.shopifyOrderId !== reservation.shopifyOrderId
    ) {
      throw new Error(
        "Reservation changed during refund verification. No tickets were canceled.",
      );
    }

    const adjustment = await tx.sixersReservationAdjustment.findFirst({
      where: {
        reservationId,
        status: {
          in: [
            "PENDING",
            "CREATING",
            "INVOICED",
            "SENDING",
            "SENT",
            "PAID",
          ],
        },
      },
    });

    if (adjustment) {
      throw new Error(
        "Reservation has a ticket adjustment. Manual review required.",
      );
    }

    const review = await tx.sixersPaymentReview.findFirst({
      where: {
        status: "OPEN",
        OR: [
          { reservationId },
          { shopifyOrderId: current.shopifyOrderId! },
        ],
      },
    });

    if (review) {
      throw new Error(
        "Resolve the open payment review before cancellation.",
      );
    }

    const canceled = await tx.eventReservation.updateMany({
      where: {
        id: reservationId,
        status: "CONFIRMED",
        paymentMethod: "CREDIT_CARD",
        shopifyOrderId: current.shopifyOrderId,
        ticketTierId: current.ticketTierId,
        quantity: current.quantity,
      },
      data: {
        status: "CANCELED",
        notes: [
          current.notes,
          `Sixers reservation canceled after Shopify full-refund verification. Shopify order ${current.shopifyOrderNumber ?? current.shopifyOrderId}. Released ${current.quantity} tickets.`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });

    if (canceled.count !== 1) {
      throw new Error(
        "Reservation changed before cancellation. No tickets were released.",
      );
    }

    return {
      success: true,
      reservationId,
      releasedQuantity: current.quantity,
    };
  });
}