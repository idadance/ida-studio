import { useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";

import { receiveSixersCheck } from "../services/sixersCheckPayment.server";

import { reconcileSixersPaidCheck } from "../services/sixersCheckReconciliation.server";

import { authenticate } from "../shopify.server";
import {
  getEvent,
  getEventCapacitySummary,
  updateEvent,
  updateEventLocation,
} from "../services/event.server";

export const loader = async ({ request, params }) => {
    const { session } = await authenticate.admin(request);

  const studioCode =
    session.shop === "ida-dance-store.myshopify.com"
      ? "FW"
      : session.shop === "ida-dance-store-pm.myshopify.com"
        ? "PM"
        : null;

  if (!studioCode) {
    throw new Response("Unrecognized Shopify store", {
      status: 403,
    });
  }

  const event = await getEvent(params.id);

  if (!event) {
    throw new Response("Event not found", {
      status: 404,
    });
  }

  const { default: prisma } = await import("../db.server");

  const paymentReviews =
    event.type === "TICKET_SALE"
      ? await prisma.sixersPaymentReview.findMany({
                    where: {
            shop: session.shop,
            reservationId: {
              in: event.ticketTiers.flatMap((tier) =>
                tier.reservations.map((reservation) => reservation.id)
              ),
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const sixersAdjustments =
    event.type === "TICKET_SALE"
      ? await prisma.sixersReservationAdjustment.findMany({
          where: {
            reservation: {
              eventLocation: {
                eventId: event.id,
                studioCode,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  const allSixersAdjustments =
    event.type === "TICKET_SALE"
      ? await prisma.sixersReservationAdjustment.findMany({
          where: {
            reservation: {
              eventLocation: {
                eventId: event.id,
              },
            },
            status: {
              in: ["PENDING", "CREATING", "INVOICED", "SENDING", "SENT"],
            },
          },
          select: {
            newTicketTierId: true,
            newQuantity: true,
            status: true,
          },
        })
      : [];

    return {
    event,
    capacitySummary: getEventCapacitySummary(event),
    paymentReviews,
    sixersAdjustments,
    allSixersAdjustments,
  };
};

export const action = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");
    if (intent === "verifySixersRefundOnly") {
    const { default: prisma } = await import("../db.server");
    const { verifySixersShopifyRefund } = await import(
      "../services/sixersRefundCancellation.server"
    );

    const reservationId = String(
      formData.get("reservationId") || "",
    ).trim();

    const account =
      session.shop === "ida-dance-store.myshopify.com"
        ? "FW"
        : session.shop === "ida-dance-store-pm.myshopify.com"
          ? "PM"
          : null;

    if (!account || !reservationId) {
      throw new Response("Invalid refund verification request.", {
        status: 400,
      });
    }

    const reservation = await prisma.eventReservation.findUnique({
      where: { id: reservationId },
      include: { eventLocation: true },
    });

    if (
      !reservation ||
      reservation.eventLocation?.eventId !== params.id ||
      reservation.eventLocation?.studioCode !== account
    ) {
      throw new Response(
        "Reservation does not belong to this event or studio.",
        { status: 400 },
      );
    }

        try {
      const { order } = await verifySixersShopifyRefund({
        admin,
        shop: session.shop,
        reservationId,
        account,
      });

      return {
        success: true,
        intent: "verifySixersRefundOnly",
        reservationId,
        verifiedOrder: order.name,
        financialStatus: order.displayFinancialStatus,
        message:
          "Shopify full-refund verification passed. No tickets were canceled.",
      };
    } catch (error) {
      console.error("Sixers refund verification failed:", error);

      return {
        success: false,
        intent: "verifySixersRefundOnly",
        reservationId,
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify the Shopify refund. No tickets were canceled.",
      };
    }
  }
    if (intent === "cancelRefundedSixersReservation") {
    const { default: prisma } = await import("../db.server");
    const { cancelVerifiedSixersRefund } = await import(
      "../services/sixersRefundCancellation.server"
    );

    const reservationId = String(
      formData.get("reservationId") || "",
    ).trim();

    const confirmedRefund =
      formData.get("confirmedRefund") === "yes";

    const account =
      session.shop === "ida-dance-store.myshopify.com"
        ? "FW"
        : session.shop === "ida-dance-store-pm.myshopify.com"
          ? "PM"
          : null;

    if (!account || !reservationId || !confirmedRefund) {
      throw new Response(
        "Refund cancellation confirmation is required.",
        { status: 400 },
      );
    }

    const reservation = await prisma.eventReservation.findUnique({
      where: { id: reservationId },
      include: { eventLocation: true },
    });

    if (
      !reservation ||
      reservation.eventLocation?.eventId !== params.id ||
      reservation.eventLocation?.studioCode !== account
    ) {
      throw new Response(
        "Reservation does not belong to this event or studio.",
        { status: 400 },
      );
    }

    const result = await cancelVerifiedSixersRefund({
      admin,
      shop: session.shop,
      reservationId,
      account,
    });

    return {
      ...result,
      intent: "cancelRefundedSixersReservation",
    };
  }
    if (intent === "updateFamilyTicketLimit") {
    const rawLimit = String(
      formData.get("maxTicketsPerFamily") ?? "",
    ).trim();

    const event = await getEvent(params.id);

    if (!event || event.type !== "TICKET_SALE") {
      throw new Response("Invalid ticket sale event.", {
        status: 400,
      });
    }

    if (
      rawLimit !== "" &&
      (!/^[1-9]\d*$/.test(rawLimit) ||
        !Number.isSafeInteger(Number(rawLimit)))
    ) {
      throw new Response(
        "Ticket limit must be a positive whole number.",
        { status: 400 },
      );
    }

    await updateEvent(params.id, {
      maxTicketsPerFamily:
        rawLimit === "" ? null : Number(rawLimit),
    });

    return {
      success: true,
      intent: "updateFamilyTicketLimit",
    };
  }
    if (intent === "updateRosterSheet") {
    const rosterSheetGid = String(
      formData.get("rosterSheetGid") || "",
    ).trim();

    const event = await getEvent(params.id);

    if (!event || event.type !== "TICKET_SALE") {
      throw new Response("Invalid ticket sale event.", {
        status: 400,
      });
    }

    if (rosterSheetGid && !/^\d+$/.test(rosterSheetGid)) {
      throw new Response(
        "Google Sheet tab ID must contain only numbers.",
        { status: 400 },
      );
    }

    await updateEvent(params.id, {
      rosterSheetGid,
    });

    return {
      success: true,
      intent: "updateRosterSheet",
    };
  }

  if (intent === "createSixersAdjustment") {
  const {
    createSixersReservationAdjustment,
  } = await import(
    "../services/sixersReservationAdjustments.server"
  );

  const reservationId = String(
    formData.get("reservationId") || ""
  ).trim();

  const newTicketTierId = String(
    formData.get("newTicketTierId") || ""
  ).trim();

  const newQuantity = Number(
    formData.get("newQuantity")
  );

  const account =
    session.shop === "ida-dance-store.myshopify.com"
      ? "FW"
      : session.shop === "ida-dance-store-pm.myshopify.com"
        ? "PM"
        : null;

  if (!account) {
    throw new Response("Unrecognized Shopify store.", {
      status: 403,
    });
  }

  const { default: prisma } = await import("../db.server");

  const reservation = await prisma.eventReservation.findUnique({
    where: { id: reservationId },
    include: { eventLocation: true },
  });

  if (
    !reservation ||
    reservation.eventLocation.eventId !== params.id ||
    reservation.eventLocation.studioCode !== account
  ) {
    throw new Response(
      "Reservation does not match this event and store.",
      { status: 400 }
    );
  }

  const adjustment = await createSixersReservationAdjustment({
    reservationId,
    newTicketTierId,
    newQuantity,
    account,
  });

  return {
    success: true,
    intent: "createSixersAdjustment",
    adjustmentId: adjustment.id,
    amountDue: adjustment.amountDue,
  };
}

if (intent === "createSixersAdjustmentInvoice") {
  const {
    createSixersAdjustmentInvoice,
  } = await import(
    "../services/sixersReservationAdjustments.server"
  );

  const adjustmentId = String(
    formData.get("adjustmentId") || ""
  ).trim();

  const account =
    session.shop === "ida-dance-store.myshopify.com"
      ? "FW"
      : session.shop === "ida-dance-store-pm.myshopify.com"
        ? "PM"
        : null;

  if (!account) {
    throw new Response("Unrecognized Shopify store.", {
      status: 403,
    });
  }

  const { default: prisma } = await import("../db.server");

  const adjustment =
    await prisma.sixersReservationAdjustment.findUnique({
      where: { id: adjustmentId },
      include: {
        reservation: {
          include: { eventLocation: true },
        },
      },
    });

  if (
    !adjustment ||
    adjustment.reservation.eventLocation.eventId !== params.id ||
    adjustment.reservation.eventLocation.studioCode !== account
  ) {
    throw new Response(
      "Adjustment does not match this event and store.",
      { status: 400 }
    );
  }

  const invoice = await createSixersAdjustmentInvoice(
    admin,
    adjustmentId,
    account
  );

  return {
    success: true,
    intent: "createSixersAdjustmentInvoice",
    adjustmentId,
    invoice,
  };
}

if (intent === "sendSixersAdjustmentInvoice") {
  const {
    sendSixersAdjustmentInvoice,
  } = await import(
    "../services/sixersReservationAdjustments.server"
  );

  const adjustmentId = String(
    formData.get("adjustmentId") || ""
  ).trim();

  const account =
    session.shop === "ida-dance-store.myshopify.com"
      ? "FW"
      : session.shop === "ida-dance-store-pm.myshopify.com"
        ? "PM"
        : null;

  if (!account) {
    throw new Response("Unrecognized Shopify store.", {
      status: 403,
    });
  }

  const { default: prisma } = await import("../db.server");

  const adjustment =
    await prisma.sixersReservationAdjustment.findUnique({
      where: { id: adjustmentId },
      include: {
        reservation: {
          include: { eventLocation: true },
        },
      },
    });

  if (
    !adjustment ||
    adjustment.reservation.eventLocation.eventId !== params.id ||
    adjustment.reservation.eventLocation.studioCode !== account
  ) {
    throw new Response(
      "Adjustment does not match this event and store.",
      { status: 400 }
    );
  }

  const result = await sendSixersAdjustmentInvoice(
    admin,
    adjustmentId,
    account
  );

  return {
    success: true,
    intent: "sendSixersAdjustmentInvoice",
    adjustmentId,
    result,
  };
}

    if (intent === "reconcileSixersPaidCheck") {
    const { default: prisma } = await import("../db.server");

    const reservationId = String(
      formData.get("reservationId") || ""
    ).trim();

    const shopifyOrderId = String(
      formData.get("shopifyOrderId") || ""
    ).trim();

    const shopifyOrderNumber = String(
      formData.get("shopifyOrderNumber") || ""
    ).trim();

    const checkNumber = String(
      formData.get("checkNumber") || ""
    ).trim();

    const account =
      session.shop === "ida-dance-store.myshopify.com"
        ? "FW"
        : session.shop === "ida-dance-store-pm.myshopify.com"
          ? "PM"
          : null;

    if (!account) {
      throw new Response("Unrecognized Shopify store.", {
        status: 403,
      });
    }

    if (
      !reservationId ||
      !shopifyOrderId.startsWith("gid://shopify/Order/")
    ) {
      throw new Response(
        "A valid reservation and Shopify order ID are required.",
        { status: 400 }
      );
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
      reservation.eventLocation.eventId !== params.id ||
      reservation.eventLocation.studioCode !== account ||
      reservation.paymentMethod !== "CHECK" ||
      reservation.ticketTier?.event.type !== "TICKET_SALE"
    ) {
      throw new Response(
        "The Sixers reservation does not match this event and store.",
        { status: 400 }
      );
    }

    await reconcileSixersPaidCheck({
      reservationId,
      shop: session.shop,
      shopifyOrderId,
      shopifyOrderNumber,
      checkNumber,
      admin,
    });

    return {
      success: true,
      intent: "reconcileSixersPaidCheck",
    };
  }

    if (intent === "receiveSixersCheck") {
    const { default: prisma } = await import("../db.server");

    const reservationId = String(
      formData.get("reservationId") || ""
    ).trim();

    const checkNumber = String(
      formData.get("checkNumber") || ""
    ).trim();

    const account =
      session.shop === "ida-dance-store.myshopify.com"
        ? "FW"
        : session.shop === "ida-dance-store-pm.myshopify.com"
          ? "PM"
          : null;

    if (!account) {
      throw new Response("Unrecognized Shopify store.", {
        status: 403,
      });
    }

    if (!reservationId || !checkNumber) {
      throw new Response(
        "Reservation ID and check number are required.",
        { status: 400 }
      );
    }

    const reservation = await prisma.eventReservation.findUnique({
      where: { id: reservationId },
      include: { eventLocation: true },
    });

    if (
      !reservation ||
      reservation.eventLocation.eventId !== params.id ||
      reservation.eventLocation.studioCode !== account
    ) {
      throw new Response(
        "Reservation not found for this event and studio.",
        { status: 404 }
      );
    }

    await receiveSixersCheck({
      reservationId,
      checkNumber,
      account,
      admin,
    });

    return { success: true, intent: "receiveSixersCheck" };
  }

  if (intent === "cancelUnpaidSixersCheck") {
  const { default: prisma } = await import("../db.server");

  const reservationId = String(
    formData.get("reservationId") || ""
  ).trim();

  const verifiedUnpaid =
    formData.get("verifiedUnpaid") === "yes";

  const account =
    session.shop === "ida-dance-store.myshopify.com"
      ? "FW"
      : session.shop === "ida-dance-store-pm.myshopify.com"
        ? "PM"
        : null;

  if (!account || !reservationId || !verifiedUnpaid) {
    throw new Response("Cancellation verification required.", {
      status: 400,
    });
  }

  const reservation = await prisma.eventReservation.findUnique({
    where: { id: reservationId },
    include: { eventLocation: true },
  });

  if (
    !reservation ||
    reservation.eventLocation?.eventId !== params.id ||
    reservation.eventLocation?.studioCode !== account ||
    !reservation.ticketTierId ||
    reservation.paymentMethod !== "CHECK" ||
       reservation.status !== "PENDING" ||
    reservation.shopifyOrderId ||
    (reservation.shopifyOrderNumber != null &&
  !/^#?D\d+$/.test(reservation.shopifyOrderNumber)) ||
    reservation.checkNumber ||
    reservation.checkReceivedAt
  ) {
    throw new Response(
      "This reservation is not eligible for unpaid check cancellation.",
      { status: 400 }
    );
  }

  const openReview = await prisma.sixersPaymentReview.findFirst({
    where: {
      reservationId,
      status: "OPEN",
    },
  });

  if (openReview) {
    throw new Response(
      "Resolve the Shopify payment review before cancellation.",
      { status: 400 }
    );
  }

  const canceled = await prisma.eventReservation.updateMany({
    where: {
      id: reservationId,
      status: "PENDING",
      paymentMethod: "CHECK",
            shopifyOrderId: null,
      shopifyOrderNumber: reservation.shopifyOrderNumber,
      checkNumber: null,
      checkReceivedAt: null,
    },
    data: {
      status: "CANCELED",
      notes: [
        reservation.notes,
        "Unpaid Sixers check reservation manually canceled. Shopify draft must be deleted separately.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  });

  if (canceled.count !== 1) {
    throw new Response(
      "Reservation changed before cancellation. Please refresh.",
      { status: 409 }
    );
  }

  return {
    success: true,
    intent: "cancelUnpaidSixersCheck",
  };
}

    if (intent === "cancelUnpaidSixersCheckout") {
    const { default: prisma } = await import("../db.server");

    const reservationId = String(
      formData.get("reservationId") || ""
    ).trim();

    const verifiedUnpaid =
      formData.get("verifiedUnpaid") === "yes";

    if (!reservationId || !verifiedUnpaid) {
      throw new Response(
        "Confirm that the reservation is unpaid before canceling.",
        { status: 400 }
      );
    }

    const account =
      session.shop === "ida-dance-store.myshopify.com"
        ? "FW"
        : session.shop === "ida-dance-store-pm.myshopify.com"
          ? "PM"
          : null;

    if (!account) {
      throw new Response("Unrecognized Shopify store.", {
        status: 403,
      });
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
      reservation.eventLocation?.eventId !== params.id ||
      reservation.eventLocation?.studioCode !== account ||
      reservation.ticketTier?.event.type !== "TICKET_SALE" ||
      reservation.paymentMethod !== "CREDIT_CARD" ||
      reservation.status !== "PENDING" ||
      reservation.shopifyOrderId ||
      reservation.shopifyOrderNumber ||
      reservation.shopifyDraftOrderId
    ) {
      throw new Response(
        "This reservation cannot be canceled as an unpaid checkout.",
        { status: 400 }
      );
    }

    const openReview = await prisma.sixersPaymentReview.findFirst({
      where: {
        reservationId,
        status: "OPEN",
      },
    });

    if (openReview) {
      throw new Response(
        "This reservation has an unresolved Shopify payment review.",
        { status: 400 }
      );
    }

    const canceled = await prisma.eventReservation.updateMany({
      where: {
        id: reservationId,
        status: "PENDING",
        paymentMethod: "CREDIT_CARD",
        shopifyOrderId: null,
        shopifyOrderNumber: null,
        shopifyDraftOrderId: null,
      },
      data: {
        status: "CANCELED",
        notes: [
          reservation.notes,
          "Unpaid Sixers checkout manually canceled after payment verification.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });

    if (canceled.count !== 1) {
      throw new Response(
        "Reservation changed before cancellation. Please refresh.",
        { status: 409 }
      );
    }

    return {
      success: true,
      intent: "cancelUnpaidSixersCheckout",
    };
  }

  if (intent === "updateSixersTier") {
    const { default: prisma } = await import("../db.server");

    const tierId = String(formData.get("tierId") || "").trim();

    const event = await prisma.event.findUnique({
      where: { id: params.id },
      select: { type: true },
    });

    if (!event || event.type !== "TICKET_SALE") {
      throw new Response("Not a ticket sale.", { status: 400 });
    }

    const tier = await prisma.eventTicketTier.findFirst({
      where: { id: tierId, eventId: params.id },
    });

    if (!tier) {
      throw new Response("Ticket tier not found.", { status: 404 });
    }

    const fields = [
      "fwCreditVariantId",
      "fwCheckVariantId",
      "pmCreditVariantId",
      "pmCheckVariantId",
    ];

    const data = {};

    for (const field of fields) {
      const value = String(formData.get(field) || "").trim();

      if (value && !/^\d+$/.test(value)) {
        throw new Response(
          "Shopify variant IDs must contain only numbers.",
          { status: 400 },
        );
      }

      data[field] = value || null;
    }

    await prisma.eventTicketTier.update({
      where: { id: tier.id },
      data,
    });

    return { success: true };
  }

  if (intent === "updateDate") {
  const dateValue = formData.get("date");

  const date = dateValue
    ? `${dateValue}:00-04:00`
    : null;

  await updateEvent(params.id, {
    date,
  });

  return { success: true };
}

  if (intent === "updateImage") {
  const imageUrl = String(
    formData.get("imageUrl") || "",
  ).trim();

  await updateEvent(params.id, {
    imageUrl,
  });

  return { success: true };
}

  if (intent === "updateLocationVariants") {
  const locationId = String(
    formData.get("locationId") || "",
  ).trim();

  const capacity = Number(
  formData.get("capacity"),
);

const price = Number(
  formData.get("price"),
);

if (
  !Number.isInteger(capacity) ||
  capacity < 0 ||
  !Number.isFinite(price) ||
  price < 0
) {
  throw new Response(
    "Capacity and price must be valid numbers.",
    {
      status: 400,
    },
  );
}

const currentEvent = await getEvent(params.id);

const currentLocation = currentEvent?.locations.find(
  (location) => location.id === locationId,
);

if (!currentLocation) {
  throw new Response("Event location not found.", {
    status: 404,
  });
}

const reservedQuantity =
  currentLocation.reservations
    ?.filter(
      (reservation) =>
        reservation.status === "PENDING" ||
        reservation.status === "CONFIRMED",
    )
    .reduce(
      (total, reservation) =>
        total + reservation.quantity,
      0,
    ) ?? 0;

if (capacity < reservedQuantity) {
  throw new Response(
    `Capacity cannot be lower than the ${reservedQuantity} spots already reserved.`,
    {
      status: 400,
    },
  );
}

  const creditVariantId = String(
    formData.get("creditVariantId") || "",
  ).trim();

  const checkVariantId = String(
    formData.get("checkVariantId") || "",
  ).trim();

  if (locationId) {
  await updateEventLocation(locationId, {
    capacity,
    price,
    creditVariantId,
    checkVariantId,
  });
}

  return { success: true };
}

  if (intent === "publish") {
    await updateEvent(params.id, {
      status: "PUBLISHED",
    });
  }

  if (intent === "unpublish") {
    await updateEvent(params.id, {
      status: "DRAFT",
    });
  }

  if (intent === "archive") {
  await updateEvent(params.id, {
    status: "ARCHIVED",
  });
}

if (intent === "addManualReservation") {
  const locationId = String(
    formData.get("locationId") || "",
  ).trim();

  const customerName = String(
    formData.get("customerName") || "",
  ).trim();

  const customerEmail = String(
    formData.get("customerEmail") || "",
  ).trim();

  const quantity = Number(
    formData.get("quantity"),
  );

  const shopifyOrderNumber = String(
    formData.get("shopifyOrderNumber") || "",
  ).trim();

  if (
    !locationId ||
    !customerName ||
    !customerEmail ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    throw new Response(
      "Please complete all required registration fields.",
      { status: 400 },
    );
  }

  const currentEvent = await getEvent(params.id);

  const location =
    currentEvent?.locations.find(
      (item) => item.id === locationId,
    );

  if (!location) {
    throw new Response(
      "Event location not found.",
      { status: 404 },
    );
  }

  const reservedQuantity =
    location.reservations
      ?.filter(
        (reservation) =>
          reservation.status === "PENDING" ||
          reservation.status === "CONFIRMED",
      )
      .reduce(
        (total, reservation) =>
          total + reservation.quantity,
        0,
      ) ?? 0;

  

  const { default: prisma } =
    await import("../db.server");

  await prisma.eventReservation.create({
    data: {
      eventLocationId: locationId,
      customerName,
      customerEmail,
      quantity,
      paymentMethod: "CREDIT_CARD",
      status: "CONFIRMED",
      totalAmount: Number(
        (
          quantity *
          location.price *
          1.026
        ).toFixed(2),
      ),
      shopifyOrderNumber:
        shopifyOrderNumber || null,
    },
  });

  return { success: true };
}

if (intent === "cancelReservation") {
  const reservationId = String(
    formData.get("reservationId") || "",
  ).trim();

  if (!reservationId) {
    throw new Response("Reservation ID is required.", {
      status: 400,
    });
  }

  const { default: prisma } = await import("../db.server");

  const reservation =
    await prisma.eventReservation.findUnique({
      where: {
        id: reservationId,
      },
      include: {
        eventLocation: true,
      },
    });

  if (
    !reservation ||
    reservation.eventLocation.eventId !== params.id
  ) {
    throw new Response("Reservation not found.", {
      status: 404,
    });
  }

  if (reservation.ticketTierId) {
    throw new Response(
      "Sixers reservations require payment verification before cancellation.",
      { status: 400 },
    );
  }

  if (reservation.status === "CANCELED") {
    return { success: true };
  }

  await prisma.eventReservation.update({
    where: {
      id: reservationId,
    },
    data: {
      status: "CANCELED",
    },
  });

  return { success: true };
}

if (intent === "delete") {
  const event = await getEvent(params.id);

  if (!event) {
    throw new Response("Event not found", {
      status: 404,
    });
  }

  if (event.status !== "ARCHIVED") {
    throw new Response(
      "Event must be archived before it can be deleted.",
      {
        status: 400,
      },
    );
  }

  // Delete the Event.
  // Event locations, reservations, and attendees cascade-delete
  // through the Prisma relationships.
  const { default: prisma } = await import("../db.server");

  await prisma.event.delete({
    where: {
      id: params.id,
    },
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/app/events",
    },
  });
}

  return { success: true };
};

export default function ManageEventPage() {
  const {
  event,
  capacitySummary,
  paymentReviews,
  sixersAdjustments,
  allSixersAdjustments,
} = useLoaderData();
  const navigation = useNavigation();
  const actionData = useActionData();

  const isSubmitting = navigation.state === "submitting";

  const [editingSixersReservationId, setEditingSixersReservationId] =
  useState(null);

  const [sixersAdjustmentType, setSixersAdjustmentType] =
  useState("add");

  const [sixersSelectedTierId, setSixersSelectedTierId] =
  useState(null);

const [sixersSelectedQuantity, setSixersSelectedQuantity] =
  useState(null);

  return (
    <s-page heading={event.name}>
      <div
        style={{
          marginBottom: "20px",
        }}
      >
        <s-link href="/app/events">
          ← Back to Events
        </s-link>
      </div>

            <s-section>
        <div
          style={{
            display: "grid",
            gap: "18px",
          }}
        >
          {event.type === "TICKET_SALE" && (
            <div>
              <strong>Google Sheet Roster</strong>

              <p>
                Enter the tab ID (gid) from your dancer
                roster in the master Google Sheet.
              </p>

              <Form
                method="post"
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="hidden"
                  name="intent"
                  value="updateRosterSheet"
                />

                <input
                  type="text"
                  name="rosterSheetGid"
                  defaultValue={event.rosterSheetGid || ""}
                  placeholder="Google Sheet tab ID"
                  inputMode="numeric"
                  style={{
                    padding: "10px",
                    minWidth: "220px",
                  }}
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                >
                  Save Roster Sheet
                </button>
              </Form>
            </div>
          )}
                    {event.type === "TICKET_SALE" && (
            <div>
              <strong>Maximum Tickets Per Family</strong>

              <p>
                Limit the total number of tickets a family
                can reserve across all price levels and
                payment methods. Leave blank for no limit.
              </p>

              <Form
                method="post"
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="hidden"
                  name="intent"
                  value="updateFamilyTicketLimit"
                />

                <input
                  type="number"
                  name="maxTicketsPerFamily"
                  min="1"
                  step="1"
                  defaultValue={event.maxTicketsPerFamily ?? ""}
                  placeholder="No limit"
                  style={{
                    padding: "10px",
                    minWidth: "220px",
                  }}
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                >
                  Save Ticket Limit
                </button>
              </Form>
            </div>
          )}
          <div>
            <strong>Status:</strong> {event.status}
          </div>

          <div>
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value={
                  event.status === "PUBLISHED"
                    ? "unpublish"
                    : "publish"
                }
              />

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 18px",
                  cursor: isSubmitting
                    ? "default"
                    : "pointer",
                }}
              >
                {isSubmitting
                  ? "Saving..."
                  : event.status === "PUBLISHED"
                    ? "Unpublish Event"
                    : "Publish Event"}
              </button>
            </Form>
            {event.status !== "ARCHIVED" && (
  <Form
    method="post"
    onSubmit={(event) => {
      const confirmed = window.confirm(
        "Archive this event? It will be removed from the active Events list, but its reservations and history will be kept.",
      );

      if (!confirmed) {
        event.preventDefault();
      }
    }}
    style={{ marginTop: "10px" }}
  >
    <input
      type="hidden"
      name="intent"
      value="archive"
    />

    <button
      type="submit"
      disabled={isSubmitting}
    >
      Archive Event
    </button>
  </Form>
)}

{event.status === "ARCHIVED" && (
  <Form
    method="post"
    onSubmit={(event) => {
      const confirmed = window.confirm(
        `PERMANENTLY delete "${event.currentTarget.dataset.eventName}"? This will delete the event and all of its associated reservations and attendee records. This cannot be undone.`,
      );

      if (!confirmed) {
        event.preventDefault();
      }
    }}
    data-event-name={event.name}
    style={{ marginTop: "10px" }}
  >
    <input
      type="hidden"
      name="intent"
      value="delete"
    />

    <button
      type="submit"
      disabled={isSubmitting}
      style={{
        color: "#b42318",
      }}
    >
      Permanently Delete Event
    </button>
  </Form>
)}
          </div>

          <div>
  <strong>Date &amp; Time:</strong>

  <Form
    method="post"
    style={{
      marginTop: "8px",
      display: "flex",
      gap: "10px",
      alignItems: "center",
      flexWrap: "wrap",
    }}
  >
    <input
      type="hidden"
      name="intent"
      value="updateDate"
    />

    <input
      type="datetime-local"
      name="date"
      required
      defaultValue={
        event.date
          ? new Intl.DateTimeFormat("sv-SE", {
              timeZone: "America/New_York",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
              .format(new Date(event.date))
              .replace(" ", "T")
          : ""
      }
    />

    <button
      type="submit"
      disabled={isSubmitting}
    >
      {isSubmitting ? "Saving..." : "Save Date & Time"}
    </button>
  </Form>
</div>

          {event.description && (
            <div>
              <strong>Description:</strong>

              <div
                style={{
                  marginTop: "6px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {event.description}
              </div>
            </div>
          )}

          <div>
            <strong>Payment Methods:</strong>{" "}
            {[
              event.creditCardEnabled
                ? "Credit Card"
                : null,
              event.checkEnabled
                ? "Check"
                : null,
            ]
              .filter(Boolean)
              .join(" • ")}
          </div>
        </div>
      </s-section>

      <s-section heading="Event Photo">
  <Form method="post">
    <input
      type="hidden"
      name="intent"
      value="updateImage"
    />

    {event.imageUrl && (
      <div style={{ marginBottom: "16px" }}>
        <img
          src={event.imageUrl}
          alt={event.name}
          style={{
            display: "block",
            width: "100%",
            maxWidth: "500px",
            height: "260px",
            objectFit: "cover",
            borderRadius: "12px",
          }}
        />
      </div>
    )}

    <label
      style={{
        display: "block",
        maxWidth: "600px",
      }}
    >
      <div
        style={{
          fontWeight: "600",
          marginBottom: "6px",
        }}
      >
        Photo URL
      </div>

      <input
        type="url"
        name="imageUrl"
        defaultValue={event.imageUrl ?? ""}
        placeholder="https://..."
        style={{
          width: "100%",
          padding: "10px",
          boxSizing: "border-box",
        }}
      />
    </label>

    <div
      style={{
        marginTop: "12px",
        color: "#666",
        fontSize: "14px",
      }}
    >
      This photo will appear on the public Event page.
    </div>

    <button
      type="submit"
      disabled={isSubmitting}
      style={{ marginTop: "14px" }}
    >
      {isSubmitting ? "Saving..." : "Save Photo"}
    </button>
  </Form>
</s-section>

      {event.type === "TICKET_SALE" && (
        <s-section heading="Sixers Ticket Setup">
          <p>
            Ticket inventory is shared between Fort Washington
            and Plymouth Meeting. Enter the Shopify variant IDs
            for each ticket price and studio.
          </p>

          {(event.ticketTiers || []).map((tier) => {
            const reserved = (tier.reservations || [])
              .filter((reservation) =>
                ["PENDING", "CONFIRMED"].includes(reservation.status)
              )
              .reduce(
                (total, reservation) => total + reservation.quantity,
                0
              );

              const adjustmentHolds = allSixersAdjustments
  .filter(
    (adjustment) =>
      adjustment.newTicketTierId === tier.id &&
      [
        "PENDING",
        "CREATING",
        "INVOICED",
        "SENDING",
        "SENT",
      ].includes(adjustment.status)
  )
  .reduce(
    (total, adjustment) =>
      total + adjustment.newQuantity,
    0
  );

            return (
              <div
                key={tier.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  padding: "20px",
                  marginTop: "16px",
                }}
              >
                <h3>{tier.name}</h3>
                <p>
                  <strong>
  {Math.max(0, tier.capacity - reserved - adjustmentHolds)}
</strong>
                  {" "}of {tier.capacity} tickets remaining
                </p>

                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="updateSixersTier"
                  />
                  <input
                    type="hidden"
                    name="tierId"
                    value={tier.id}
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "14px",
                    }}
                  >
                    {[
                      ["fwCreditVariantId", "FW Credit Card"],
                      ["fwCheckVariantId", "FW Check"],
                      ["pmCreditVariantId", "PM Credit Card"],
                      ["pmCheckVariantId", "PM Check"],
                    ].map(([field, label]) => (
                      <label key={field}>
                        <div style={{ marginBottom: "5px" }}>
                          {label} Variant ID
                        </div>
                        <input
                          type="text"
                          name={field}
                          defaultValue={tier[field] || ""}
                          placeholder="Shopify numeric variant ID"
                          style={{
                            width: "100%",
                            padding: "9px",
                            boxSizing: "border-box",
                          }}
                        />
                      </label>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ marginTop: "16px" }}
                  >
                    {isSubmitting
                      ? "Saving..."
                      : "Save Ticket Setup"}
                  </button>
                </Form>
              </div>
            );
          })}
        </s-section>
      )}

      {event.type !== "TICKET_SALE" && (
      <s-section heading="Studio Locations">
        <div
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          {capacitySummary.locations.map(
            (location) => (
              <div
                key={location.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  padding: "20px",
                }}
              >
                <strong
                  style={{
                    fontSize: "18px",
                  }}
                >
                  {location.studioCode === "FW"
                    ? "Fort Washington"
                    : location.studioCode === "PM"
                      ? "Plymouth Meeting"
                      : location.name}
                </strong>

                <div
                  style={{
                    marginTop: "12px",
                  }}
                >
                  <strong>
                    {location.reservedQuantity} /{" "}
                    {location.capacity}
                  </strong>{" "}
                  spots reserved
                </div>

                <div
                  style={{
                    marginTop: "5px",
                  }}
                >
                  {location.remainingCapacity} spots
                  remaining
                </div>

                <div
                  style={{
                    marginTop: "5px",
                  }}
                >
                  $
                  {Number(location.price).toFixed(2)} per
                  spot
                </div>

                <Form
  method="post"
  style={{
    marginTop: "18px",
    paddingTop: "16px",
    borderTop: "1px solid #ddd",
  }}
>
  <input
    type="hidden"
    name="intent"
    value="updateLocationVariants"
  />

  <input
    type="hidden"
    name="locationId"
    value={location.id}
  />

  <div
    style={{
      fontWeight: "600",
      marginBottom: "12px",
    }}
  >
    Shopify Checkout Setup
    <label
  style={{
    display: "block",
    marginBottom: "12px",
  }}
>
  <div style={{ marginBottom: "5px" }}>
    Capacity
  </div>

  <input
    type="number"
    name="capacity"
    min="0"
    defaultValue={location.capacity}
    required
    style={{
      width: "100%",
      padding: "8px",
      boxSizing: "border-box",
    }}
  />
</label>
<label
  style={{
    display: "block",
    marginBottom: "18px",
  }}
>
  <div style={{ marginBottom: "5px" }}>
    Price Per Spot
  </div>

  <input
    type="number"
    name="price"
    min="0"
    step="0.01"
    defaultValue={location.price}
    required
    style={{
      width: "100%",
      padding: "8px",
      boxSizing: "border-box",
    }}
  />
</label>
  </div>

  <label
    style={{
      display: "block",
      marginBottom: "12px",
    }}
  >
    <div style={{ marginBottom: "5px" }}>
      Credit Variant ID
    </div>

    <input
      type="text"
      name="creditVariantId"
      defaultValue={location.creditVariantId ?? ""}
      style={{
        width: "100%",
        padding: "8px",
        boxSizing: "border-box",
      }}
    />
  </label>

  <label
    style={{
      display: "block",
      marginBottom: "12px",
    }}
  >
    <div style={{ marginBottom: "5px" }}>
      Check Variant ID
    </div>

    <input
      type="text"
      name="checkVariantId"
      defaultValue={location.checkVariantId ?? ""}
      style={{
        width: "100%",
        padding: "8px",
        boxSizing: "border-box",
      }}
    />
  </label>

  <button type="submit" disabled={isSubmitting}>
{isSubmitting ? "Saving..." : "Save Location Changes"}  </button>
</Form>
              </div>
            ),
          )}
        </div>

        {capacitySummary.locations.length > 1 && (
          <div
            style={{
              marginTop: "18px",
              padding: "16px",
              border: "1px solid #ddd",
              borderRadius: "12px",
            }}
          >
            <strong>Overall Event Capacity</strong>

            <div
              style={{
                marginTop: "8px",
              }}
            >
              {capacitySummary.totalReserved} /{" "}
              {capacitySummary.totalCapacity} spots
              reserved
            </div>

            <div
              style={{
                marginTop: "4px",
              }}
            >
              {capacitySummary.totalRemaining} total spots
              remaining
            </div>
          </div>
        )}
      </s-section>

      )}

      {event.type !== "TICKET_SALE" && (
      <s-section heading="Add Registration">
  <Form
    method="post"
    style={{
      display: "grid",
      gap: "14px",
      maxWidth: "600px",
    }}
  >
    <input
      type="hidden"
      name="intent"
      value="addManualReservation"
    />

    <label>
      <div
        style={{
          fontWeight: "600",
          marginBottom: "5px",
        }}
      >
        Studio
      </div>

      <select
        name="locationId"
        required
        defaultValue=""
        style={{
          width: "100%",
          padding: "9px",
        }}
      >
        <option value="" disabled>
          Select studio
        </option>

        {event.locations.map((location) => (
          <option
            key={location.id}
            value={location.id}
          >
            {location.studioCode === "FW"
              ? "Fort Washington"
              : location.studioCode === "PM"
                ? "Plymouth Meeting"
                : location.name}
          </option>
        ))}
      </select>
    </label>

    <label>
      <div
        style={{
          fontWeight: "600",
          marginBottom: "5px",
        }}
      >
        Parent Name
      </div>

      <input
        type="text"
        name="customerName"
        required
        style={{
          width: "100%",
          padding: "9px",
          boxSizing: "border-box",
        }}
      />
    </label>

    <label>
      <div
        style={{
          fontWeight: "600",
          marginBottom: "5px",
        }}
      >
        Email
      </div>

      <input
        type="email"
        name="customerEmail"
        required
        style={{
          width: "100%",
          padding: "9px",
          boxSizing: "border-box",
        }}
      />
    </label>

    <label>
      <div
        style={{
          fontWeight: "600",
          marginBottom: "5px",
        }}
      >
        Number of Spots
      </div>

      <input
        type="number"
        name="quantity"
        min="1"
        required
        style={{
          width: "100%",
          padding: "9px",
          boxSizing: "border-box",
        }}
      />
    </label>

    <label>
      <div
        style={{
          fontWeight: "600",
          marginBottom: "5px",
        }}
      >
        Shopify Order Number
      </div>

      <input
        type="text"
        name="shopifyOrderNumber"
        placeholder="Example: #23668"
        style={{
          width: "100%",
          padding: "9px",
          boxSizing: "border-box",
        }}
      />
    </label>

    <div
      style={{
        fontSize: "14px",
        color: "#666",
      }}
    >
      Use this for an already-paid registration that needs
      to be added to IDA Studio. This will not charge the
      customer again.
    </div>

    <button
      type="submit"
      disabled={isSubmitting}
    >
      {isSubmitting
        ? "Adding..."
        : "Add Paid Registration"}
    </button>
  </Form>
</s-section>

      )}

      {event.type === "TICKET_SALE" && (
        <s-section heading="Sixers Reservations">
          {event.ticketTiers.every(tier => tier.reservations.length === 0) ? (
            <p>No Sixers reservations yet.</p>
          ) : (
            event.ticketTiers.flatMap(tier =>
              tier.reservations.map(reservation => {
                const studio = event.locations.find(
                  location => location.id === reservation.eventLocationId
                );
                return (
                  <div key={reservation.id} style={{
                    border: "1px solid #ddd",
                    borderRadius: "10px",
                    padding: "16px",
                    marginBottom: "12px"
                  }}>
                    <strong>{reservation.customerName}</strong>
                    <div>{reservation.customerEmail}</div>
                    <div>Ticket Level: {tier.name}</div>
                    <div>Tickets: {reservation.quantity}</div>
                    <div>Studio: {studio?.studioCode || "Unknown"}</div>
                    <div>Payment: {reservation.paymentMethod === "CREDIT_CARD" ? "Credit Card" : "Check"}</div>
                    <div>Status: {reservation.status}</div>
                    <div>
  Reserved: {new Date(reservation.createdAt).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} ET
</div>
                    {reservation.shopifyOrderNumber && (
                      <div>
                        Shopify Order: {reservation.shopifyOrderNumber}
                      </div>
                    )}
                    {reservation.ticketTierId &&
  reservation.paymentMethod === "CREDIT_CARD" &&
  reservation.status === "CONFIRMED" &&
  reservation.shopifyOrderId && (
    <Form method="post" style={{ marginTop: "12px" }}>
      <input
        type="hidden"
        name="intent"
        value="verifySixersRefundOnly"
      />
      <input
        type="hidden"
        name="reservationId"
        value={reservation.id}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          padding: "10px 16px",
          borderRadius: "6px",
          border: "1px solid #3da5be",
          background: "white",
          color: "#237b91",
          cursor: isSubmitting ? "default" : "pointer",
        }}
      >
        {isSubmitting
          ? "Verifying..."
          : "Verify Shopify Refund"}
      </button>
    </Form>
    )}
    {actionData?.intent === "verifySixersRefundOnly" &&
  actionData?.reservationId === reservation.id && (
    <div
      style={{
        marginTop: "10px",
        padding: "12px",
        border: `1px solid ${
          actionData.success ? "#3da5be" : "#b42318"
        }`,
        borderRadius: "6px",
        background: actionData.success ? "#f0fafc" : "#fff4f2",
      }}
    >
      <strong>
        {actionData.success
          ? "Shopify Refund Verified"
          : "Refund Verification Failed"}
      </strong>

      {actionData.success && (
        <>
          <div>Order: {actionData.verifiedOrder}</div>
          <div>Status: {actionData.financialStatus}</div>
        </>
      )}

      <div>{actionData.message}</div>
    </div>
  )}
                    {false && reservation.ticketTierId &&
  reservation.paymentMethod === "CREDIT_CARD" &&
  reservation.status === "CONFIRMED" &&
  reservation.shopifyOrderId && (
    <Form
      method="post"
      style={{ marginTop: "12px" }}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Cancel ${reservation.customerName}'s ${reservation.quantity} Sixers ticket(s)?\n\nShopify must already show a FULL REFUND for order ${reservation.shopifyOrderNumber || reservation.shopifyOrderId}.\n\nThis action does NOT issue a refund. It will release the tickets in IDA Studio only after Shopify verifies the refund.\n\nContinue?`
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input
        type="hidden"
        name="intent"
        value="cancelRefundedSixersReservation"
      />

      <input
        type="hidden"
        name="reservationId"
        value={reservation.id}
      />

      <input
        type="hidden"
        name="confirmedRefund"
        value="yes"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          padding: "10px 16px",
          borderRadius: "6px",
          border: "1px solid #b42318",
          background: "white",
          color: "#b42318",
          cursor: isSubmitting ? "default" : "pointer",
        }}
      >
        {isSubmitting
          ? "Verifying Refund..."
          : "Cancel Refunded Reservation"}
      </button>
    </Form>
  )}
                    {reservation.paymentMethod === "CREDIT_CARD" &&
                      reservation.status === "PENDING" &&
                      Date.now() - new Date(reservation.createdAt).getTime() >
                        30 * 60 * 1000 && (
                        <div style={{ color: "#b45309", fontWeight: "bold" }}>
                          ⚠️ Credit card checkout pending over 30 minutes.
                          Verify payment in Shopify before taking action.
                        </div>
                      )}
                    <div>Total: ${Number(reservation.totalAmount).toFixed(2)}</div>
                   {reservation.status === "CONFIRMED" && (
  <button
    type="button"
    onClick={() => {
  setEditingSixersReservationId(
    editingSixersReservationId === reservation.id
      ? null
      : reservation.id
  );
  setSixersAdjustmentType("add");
  setSixersSelectedTierId(null);
  setSixersSelectedQuantity(null);
}}
    style={{
      marginTop: "12px",
      padding: "10px 16px",
      borderRadius: "6px",
      background: "#fff",
      border: "1px solid #333",
      cursor: "pointer",
    }}
  >
    {editingSixersReservationId === reservation.id
      ? "Close Editor"
      : "Edit Reservation"}
  </button>
)}
{editingSixersReservationId === reservation.id && (
  <div
    style={{
      marginTop: "12px",
      padding: "16px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      background: "#fafafa",
    }}
  >
    {sixersAdjustments
  .filter(
    (adjustment) =>
      adjustment.reservationId === reservation.id
  )
  .map((adjustment) => (
    <div
      key={adjustment.id}
      style={{
        padding: "12px",
        marginBottom: "14px",
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: "8px",
      }}
    >
      <strong>Ticket Adjustment</strong>

      <div>
        Amount Due: ${Number(adjustment.amountDue).toFixed(2)}
      </div>

      <div>
        Status: {adjustment.status}
      </div>

      {adjustment.shopifyOrderNumber && (
        <div>
          Paid Shopify Order: {adjustment.shopifyOrderNumber}
        </div>
      )}

      {adjustment.shopifyDraftOrderId && (
        <div>Shopify Draft Invoice Created</div>
      )}
      {adjustment.status === "PENDING" && (
  <Form
    method="post"
    style={{ marginTop: "12px" }}
    onSubmit={(event) => {
      if (
        !window.confirm(
          `Create a Shopify draft invoice for $${Number(
            adjustment.amountDue
          ).toFixed(2)}?\n\nThis will NOT email the customer.`
        )
      ) {
        event.preventDefault();
      }
    }}
  >
    <input
      type="hidden"
      name="intent"
      value="createSixersAdjustmentInvoice"
    />
    <input
      type="hidden"
      name="adjustmentId"
      value={adjustment.id}
    />

    <button type="submit" disabled={isSubmitting}>
      {isSubmitting ? "Creating..." : "Create Shopify Invoice"}
    </button>
  </Form>
)}
{adjustment.status === "INVOICED" &&
  adjustment.shopifyDraftOrderId && (
    <Form
      method="post"
      style={{ marginTop: "12px" }}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Send the $${Number(
              adjustment.amountDue
            ).toFixed(2)} Sixers ticket invoice to ${reservation.customerEmail}?\n\nThis WILL email the customer.`
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input
        type="hidden"
        name="intent"
        value="sendSixersAdjustmentInvoice"
      />
      <input
        type="hidden"
        name="adjustmentId"
        value={adjustment.id}
      />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send Invoice to Customer"}
      </button>
    </Form>
  )}
    </div>
  ))}
    <strong>Edit Sixers Tickets</strong>

    {sixersAdjustments.some(
      (adjustment) =>
        adjustment.reservationId === reservation.id &&
        ["PENDING", "CREATING", "INVOICED", "SENDING", "SENT"].includes(
          adjustment.status
        )
    ) ? (
      <p>
        This reservation already has an adjustment awaiting payment
        or invoice processing. Please review that adjustment before
        making another change.
      </p>
    ) : (
      <Form
  method="post"
  onSubmit={(submitEvent) => {
    const form = submitEvent.currentTarget;
    const formData = new FormData(form);

    const selectedTierId = String(
      formData.get("newTicketTierId") || ""
    );

    const quantity = Number(formData.get("newQuantity"));

    const selectedTier = event.ticketTiers.find(
      (option) => option.id === selectedTierId
    );

    const isValid =
      sixersAdjustmentType === "upgrade"
        ? selectedTierId !== tier.id &&
          selectedTier &&
          Number(selectedTier.price) > Number(tier.price) &&
          quantity === reservation.quantity
        : selectedTierId === tier.id &&
          Number.isSafeInteger(quantity) &&
          quantity > reservation.quantity;

    if (!isValid) {
      window.alert(
        "Please select a valid ticket change before continuing."
      );
      submitEvent.preventDefault();
      return;
    }

    if (
      !window.confirm(
        `Create this ticket adjustment for ${reservation.customerName}?\n\nThis will hold the additional tickets but will NOT create or send an invoice.`
      )
    ) {
      submitEvent.preventDefault();
    }
  }}
>
        <input
          type="hidden"
          name="intent"
          value="createSixersAdjustment"
        />
        <input
          type="hidden"
          name="reservationId"
          value={reservation.id}
        />

        <label style={{ display: "block", marginTop: "12px" }}>
  Adjustment Type
  <select
    value={sixersAdjustmentType}
    onChange={(event) => {
  setSixersAdjustmentType(event.target.value);
  setSixersSelectedTierId(null);
  setSixersSelectedQuantity(null);
}}
    style={{
      display: "block",
      width: "100%",
      padding: "10px",
      marginTop: "5px",
    }}
  >
    <option value="add">Add Tickets</option>
    <option value="upgrade">Upgrade Tickets</option>
  </select>
</label>

        <label style={{ display: "block", marginTop: "12px" }}>
          Ticket Level
         <select
  name="newTicketTierId"
  key={`${reservation.id}-${sixersAdjustmentType}`}
  defaultValue={tier.id}
  onChange={(event) =>
  setSixersSelectedTierId(event.target.value)
}
  required
  style={{
              display: "block",
              width: "100%",
              padding: "10px",
              marginTop: "5px",
            }}
          >
            {event.ticketTiers
  .filter(
    (option) =>
      sixersAdjustmentType === "upgrade" ||
      option.id === tier.id
  )
  .map((option) => (
    <option key={option.id} value={option.id}>
      {option.name} — ${Number(option.price).toFixed(2)}
    </option>
  ))}
          </select>
        </label>

        <label style={{ display: "block", marginTop: "12px" }}>
          Total Tickets After Change
          <input
  type="number"
  name="newQuantity"
  key={`${reservation.id}-${sixersAdjustmentType}`}
  onChange={(event) =>
  setSixersSelectedQuantity(Number(event.target.value))
}
  min={
    sixersAdjustmentType === "add"
      ? reservation.quantity + 1
      : reservation.quantity
  }
  max={
    sixersAdjustmentType === "upgrade"
      ? reservation.quantity
      : undefined
  }
  defaultValue={
    sixersAdjustmentType === "add"
      ? reservation.quantity + 1
      : reservation.quantity
  }
  readOnly={sixersAdjustmentType === "upgrade"}
  required
            style={{
              display: "block",
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              boxSizing: "border-box",
            }}
          />
        </label>

        <p>
          Current reservation: {reservation.quantity} × {tier.name}.
          Changing ticket levels keeps the same quantity.
          Adding tickets keeps the same level.
        </p>

        <div
  style={{
    marginTop: "14px",
    padding: "12px",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
  }}
>
  <strong>Payment Preview</strong>

  {(() => {
  const selectedTier =
    event.ticketTiers.find(
      (option) =>
        option.id ===
        (sixersAdjustmentType === "add"
          ? tier.id
          : sixersSelectedTierId || tier.id)
    );

  const quantity =
    sixersAdjustmentType === "upgrade"
      ? reservation.quantity
      : sixersSelectedQuantity ??
        reservation.quantity + 1;

  const creditPrice = (price) =>
    Math.round(Number(price) * 1.026 * 100) / 100;

  const amountDue =
    sixersAdjustmentType === "upgrade"
      ? reservation.quantity *
        (creditPrice(selectedTier?.price ?? tier.price) -
          creditPrice(tier.price))
      : (quantity - reservation.quantity) *
        creditPrice(tier.price);

  const valid =
    sixersAdjustmentType === "upgrade"
      ? selectedTier &&
        selectedTier.id !== tier.id &&
        Number(selectedTier.price) > Number(tier.price)
      : Number.isSafeInteger(quantity) &&
        quantity > reservation.quantity;

  return (
    <div style={{ marginTop: "10px" }}>
      <div>
        {sixersAdjustmentType === "upgrade"
          ? "Upgrade difference"
          : "Additional ticket charge"}
      </div>

      <strong style={{ fontSize: "22px" }}>
        {valid ? `$${amountDue.toFixed(2)}` : "Select a valid change"}
      </strong>

      <div style={{ fontSize: "12px", marginTop: "5px" }}>
        Includes the 2.6% credit card fee, rounded per ticket.
      </div>
    </div>
  );
})()}

  
</div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Processing..." : "Create Adjustment"}
        </button>
      </Form>
          
    )}
  </div>
)}
                    {reservation.paymentMethod === "CREDIT_CARD" &&
  reservation.status === "PENDING" &&
  !reservation.shopifyOrderId &&
  !reservation.shopifyOrderNumber &&
  !reservation.shopifyDraftOrderId &&
  !paymentReviews.some(
    (review) =>
      review.reservationId === reservation.id &&
      review.status === "OPEN"
  ) && (
    <Form
      method="post"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Cancel ${reservation.customerName}'s unpaid checkout for ${reservation.quantity} ticket(s)?\n\nOnly continue after verifying no Shopify payment was received. An old checkout link may still be usable.`
          )
        ) {
          event.preventDefault();
        }
      }}
      style={{ marginTop: "12px" }}
    >
      <input
        type="hidden"
        name="intent"
        value="cancelUnpaidSixersCheckout"
      />
      <input
        type="hidden"
        name="reservationId"
        value={reservation.id}
      />
      <input
        type="hidden"
        name="verifiedUnpaid"
        value="yes"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          padding: "10px 16px",
          borderRadius: "6px",
          background: "#fff",
          color: "#b91c1c",
          border: "1px solid #b91c1c",
          cursor: isSubmitting ? "default" : "pointer",
        }}
      >
        {isSubmitting ? "Processing..." : "Cancel Unpaid Checkout"}
      </button>
    </Form>
  )}
                {reservation.paymentMethod === "CHECK" &&
  reservation.status === "PENDING" && (
    <>
      {/* Receive Check */}
      <Form method="post" style={{ marginTop: "12px" }}>
        <input
          type="hidden"
          name="intent"
          value="receiveSixersCheck"
        />

        <input
          type="hidden"
          name="reservationId"
          value={reservation.id}
        />

        <label style={{ display: "block", marginBottom: "6px" }}>
          Check Number
        </label>

        <input
          type="text"
          name="checkNumber"
          required
          placeholder="Enter check number"
          style={{
            display: "block",
            width: "100%",
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            marginBottom: "8px",
          }}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: "10px 16px",
            borderRadius: "6px",
            cursor: isSubmitting ? "default" : "pointer",
          }}
        >
          {isSubmitting ? "Processing..." : "Receive Check"}
        </button>
      </Form>

      {/* Cancel Unpaid Check */}
      {!reservation.checkNumber &&
        !reservation.checkReceivedAt &&
        !reservation.shopifyOrderId && (
          <Form
            method="post"
            style={{ marginTop: "10px" }}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  `Cancel the unpaid check reservation for ${reservation.customerName} (${reservation.quantity} tickets)?\n\nThis will release the tickets. Verify that the Shopify draft has been deleted and no payment was received.`
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input
              type="hidden"
              name="intent"
              value="cancelUnpaidSixersCheck"
            />

            <input
              type="hidden"
              name="reservationId"
              value={reservation.id}
            />

            <input
              type="hidden"
              name="verifiedUnpaid"
              value="yes"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "10px 16px",
                borderRadius: "6px",
                border: "1px solid #b42318",
                background: "white",
                color: "#b42318",
                cursor: isSubmitting ? "default" : "pointer",
              }}
            >
              {isSubmitting ? "Processing..." : "Cancel Unpaid Check"}
            </button>
          </Form>
        )}
    </>
  )}
                  </div>
                );
              })
            )
          )}
        </s-section>
      )}

      {event.type === "TICKET_SALE" && (
        <s-section heading="Sixers Payment Reviews">
          {paymentReviews.length === 0 ? (
            <p>No payment reviews linked to this event.</p>
          ) : (
            paymentReviews.map((review) => (
              <div
                key={review.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "16px",
                  marginBottom: "12px",
                }}
              >
                <strong>
                  {review.shopifyOrderNumber || review.shopifyOrderId}
                </strong>
                <div>Store: {review.shop}</div>
                <div>Reason: {review.reason}</div>
                <div>Status: {review.status}</div>
                <div>Reservation ID: {review.reservationId || "Not linked"}</div>
                <div>
                  Flagged: {new Date(review.createdAt).toLocaleString()}
                </div>
                {review.status === "OPEN" && review.reservationId && (
  <Form method="post" style={{ marginTop: "12px" }}>
    <input
      type="hidden"
      name="intent"
      value="reconcileSixersPaidCheck"
    />

    <input
      type="hidden"
      name="reservationId"
      value={review.reservationId}
    />

    <input
      type="hidden"
      name="shopifyOrderId"
      value={`gid://shopify/Order/${review.shopifyOrderId}`}
    />

    <input
      type="hidden"
      name="shopifyOrderNumber"
      value={review.shopifyOrderNumber || ""}
    />

    <label style={{ display: "block", marginBottom: "6px" }}>
      Check Number
    </label>

    <input
      type="text"
      name="checkNumber"
      required
      placeholder="Enter check number"
      style={{
        display: "block",
        width: "100%",
        padding: "8px",
        marginBottom: "8px",
      }}
    />

    <button type="submit" disabled={isSubmitting}>
      {isSubmitting ? "Processing..." : "Reconcile Paid Order"}
    </button>
  </Form>
)}
              </div>
            ))
          )}
        </s-section>
      )}

      {event.type !== "TICKET_SALE" && (
      <s-section heading="Reservations">
        {capacitySummary.totalReserved === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
            }}
          >
            <div
              style={{
                fontSize: "44px",
                marginBottom: "12px",
              }}
            >
              🎟️
            </div>

            <h2>No Reservations Yet</h2>

            <p>
              Reservations will appear here once
              registration opens.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "20px",
            }}
          >
            {event.locations.map((location) => (
              <div key={location.id}>
                <h3>{location.name}</h3>

                {location.reservations.map(
                  (reservation) => (
                    <div
                      key={reservation.id}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: "10px",
                        padding: "14px",
                        marginTop: "10px",
                      }}
                    >
                      <strong>
                        {reservation.customerName}
                      </strong>

                      <div>
                        {reservation.customerEmail}
                      </div>

                      <div
                        style={{
                          marginTop: "6px",
                        }}
                      >
                        Spots: {reservation.quantity}
                      </div>

                      {reservation.attendees?.length > 0 && (
  <div
    style={{
      marginTop: "10px",
      padding: "10px 12px",
      background: "#f6f6f6",
      borderRadius: "8px",
    }}
  >
    <strong>
      {reservation.attendees.length === 1
        ? "Dancer"
        : "Dancers"}
    </strong>

    {reservation.attendees.map((attendee, index) => (
      <div
        key={attendee.id}
        style={{
          marginTop: "4px",
        }}
      >
        {reservation.attendees.length > 1
          ? `${index + 1}. `
          : ""}
        {attendee.name} — {attendee.grade}
      </div>
    ))}
  </div>
)}

                      <div>
                        Payment:{" "}
                        {reservation.paymentMethod ===
                        "CREDIT_CARD"
                          ? "Credit Card"
                          : "Check"}
                      </div>

                      <div>
                        Status: {reservation.status}
                      </div>

                      <div>
                        Total: $
                        {Number(
                          reservation.totalAmount,
                        ).toFixed(2)}
                      </div>
                      {reservation.status !== "CANCELED" && (
  <Form
    method="post"
    onSubmit={(event) => {
      const confirmed = window.confirm(
        `Cancel the registration for ${reservation.customerName}? Their ${reservation.quantity} spot${reservation.quantity === 1 ? "" : "s"} will be returned to available inventory. This does not issue a Shopify refund.`,
      );

      if (!confirmed) {
        event.preventDefault();
      }
    }}
    style={{
      marginTop: "12px",
    }}
  >
    <input
      type="hidden"
      name="intent"
      value="cancelReservation"
    />

    <input
      type="hidden"
      name="reservationId"
      value={reservation.id}
    />

    <button
      type="submit"
      disabled={isSubmitting}
      style={{
        color: "#b42318",
      }}
    >
      Cancel Registration
    </button>
  </Form>
)}
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        )}
      </s-section>
      )}
    </s-page>
  );
}