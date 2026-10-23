
import prisma from "../db.server";

export async function recordSixersPaymentReview({
  shop,
  payload,
  reservationId = null,
  reason,
}) {
  const shopifyOrderId = String(payload.id);

  return prisma.sixersPaymentReview.upsert({
    where: {
      shop_shopifyOrderId: {
        shop,
        shopifyOrderId,
      },
    },
    create: {
      shop,
      shopifyOrderId,
      shopifyOrderNumber: payload.name || null,
      reservationId,
      reason,
    },
    update: {
      reason,
      reservationId,
      status: "OPEN",
      resolvedAt: null,
      resolutionNotes: null,
    },
  });
}

export async function resolveSixersPaymentReview({
  shop,
  shopifyOrderId,
  reservationId,
  notes,
}) {
  return prisma.sixersPaymentReview.updateMany({
    where: {
      shop,
      shopifyOrderId,
      reservationId,
      status: "OPEN",
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolutionNotes: notes,
    },
  });
}

export async function safelyResolveSixersPaymentReview({
  shop,
  shopifyOrderId,
  reservationId,
  notes,
}) {
  try {
    await resolveSixersPaymentReview({
      shop,
      shopifyOrderId,
      reservationId,
      notes,
    });

    return true;
  } catch (error) {
    console.error(
      "Sixers payment review could not be resolved:",
      {
        shop,
        shopifyOrderId,
        reservationId,
        error,
      },
    );

    return false;
  }
}
