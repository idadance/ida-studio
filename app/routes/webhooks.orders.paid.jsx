import { authenticate } from "../shopify.server";
import { findShowByVariantId } from "../services/showLookup.server";
import {
  createReservation,
  createTicketOrders,
} from "../services/ticketOrders.server";
import { sendPaidTicketConfirmation } from "../services/email.server";
import prisma from "../db.server";
import { prepareCustomerFolder } from "../services/googleDrive.server";
import {
  generateTicketAssets,
} from "../services/ticketGenerator.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } =
    await authenticate.webhook(request);

  console.log(
    "Financial Status:",
    payload.financial_status,
  );

  // ======================================
  // Only process paid Shopify orders
  // ======================================

  if (payload.financial_status !== "paid") {
    console.log(
      "⏭️ Order is not paid. Skipping ticket generation.",
    );

    return new Response();
  }

  // ======================================
  // Pay by Check orders are already
  // reservations in IDA Tickets.
  //
  // Receive Check completes the Shopify
  // Draft Order, which fires orders/paid.
  // Do NOT create another reservation.
  // ======================================

  const tags =
    typeof payload.tags === "string"
      ? payload.tags
          .split(",")
          .map((tag) => tag.trim())
      : [];

  if (tags.includes("Check Payment")) {
  console.log(
    `💳 ${payload.name} came from an IDA Check Payment draft order.`,
  );

  // ======================================
  // FIND THE ORIGINAL SHOPIFY DRAFT ORDER
  // ======================================

  const draftOrderId =
    payload.draft_order_id
      ? `gid://shopify/DraftOrder/${payload.draft_order_id}`
      : null;

  if (!draftOrderId) {
    console.log(
      "⚠️ Paid Check Payment order did not include a draft order ID.",
    );

    return new Response();
  }

  const reservation =
    await prisma.reservation.findFirst({
      where: {
        shopifyOrderId:
          draftOrderId,
      },

      include: {
        performance: true,

        ticketOrders: {
          where: {
            status: "PENDING",
          },

          include: {
            show: true,
          },
        },
      },
    });

  if (!reservation) {
    console.log(
      `⚠️ No existing IDA reservation found for draft order ${draftOrderId}.`,
    );

    return new Response();
  }

  console.log(
    `✅ Existing reservation found: ${reservation.id}`,
  );

  const paidAt =
    new Date();

  // ======================================
  // CONFIRM ALL CURRENTLY UNPAID TICKETS
  //
  // Send Invoice rebuilt the Shopify
  // draft order using all unpaid items.
  // A paid invoice therefore means these
  // pending tickets have now been paid.
  // ======================================

  const pendingTickets =
    reservation.ticketOrders;

  if (pendingTickets.length > 0) {
    await prisma.ticketOrder.updateMany({
      where: {
        reservationId:
          reservation.id,

        status:
          "PENDING",
      },

      data: {
        status:
          "CONFIRMED",

        checkReceivedAt:
          paidAt,
      },
    });
  }

  // ======================================
  // GENERATE TICKETS FOR FUTURE SHOWS
  //
  // Do not send ticket PDFs for shows
  // that already happened.
  // ======================================

  for (
    const ticket of
    pendingTickets
  ) {
    const showDate =
      ticket.show?.date;

    const shouldGenerateTicket =
      !showDate ||
      new Date(showDate) >
        new Date();

    if (shouldGenerateTicket) {
      await generateTicketAssets(
        ticket.id,
      );
    } else {
      console.log(
        `⏭️ Skipping ticket generation for past show ${ticket.show?.name}`,
      );
    }
  }

  // ======================================
  // DIGITAL VIDEO
  // ======================================

  if (
    reservation.digitalVideo &&
    !reservation.digitalVideoPaid
  ) {
    await prepareCustomerFolder(
      reservation.performance,
      reservation,
      true,
    );
  }

  // ======================================
  // MARK RESERVATION PAID
  // ======================================

  await prisma.reservation.update({
    where: {
      id:
        reservation.id,
    },

    data: {
      status:
        "CONFIRMED",

      ...(reservation.digitalVideo
        ? {
            digitalVideoPaid:
              true,
          }
        : {}),
    },
  });

  console.log(
    `✅ Online invoice payment completed for existing reservation ${reservation.id}`,
  );

  return new Response();
}

// ======================================
// EXTRA TICKET REQUEST PAYMENT
//
// The reservation + pending TicketOrder
// were already created when the request
// was approved and the invoice was sent.
// Do NOT create another reservation.
// ======================================

if (
  tags.includes(
    "Extra Ticket Request",
  )
) {
  console.log(
    `🎟️ ${payload.name} is a paid Extra Ticket Request.`,
  );

  // ======================================
  // FIND EXTRA TICKET REQUEST ID
  //
  // New invoices carry a tag like:
  // ExtraTicketRequest:<request id>
  // ======================================

  const requestTag =
    tags.find((tag) =>
      tag.startsWith(
  "ETR:",
)
    );

  const taggedRequestId =
    requestTag
      ? requestTag.slice(
  "ETR:".length,
)
      : null;

  let reservation = null;

  // ======================================
  // PRIMARY LOOKUP
  // Use the request ID embedded in the
  // Shopify order tag.
  // ======================================

  if (taggedRequestId) {
    reservation =
      await prisma.reservation.findFirst({
        where: {
          extraTicketRequestId:
            taggedRequestId,
        },

        include: {
          performance: true,

          ticketOrders: {
            where: {
              status:
                "PENDING",
            },

            include: {
              show: true,
            },
          },
        },
      });
  }

  // ======================================
  // LEGACY / TEST FALLBACK
  //
  // Older Extra Ticket invoices created
  // before the request-ID tag existed may
  // not include draft_order_id either.
  //
  // Match a single pending Extra Ticket
  // reservation using customer email and
  // the Shopify order's ticket products.
  // ======================================

  if (!reservation) {
    const customerEmail =
      (
        payload.customer?.email ??
        payload.email ??
        ""
      )
        .trim()
        .toLowerCase();

    if (customerEmail) {
      const candidates =
        await prisma.reservation.findMany({
          where: {
            customerEmail: {
              equals:
                customerEmail,
              mode:
                "insensitive",
            },

            extraTicketRequestId: {
              not: null,
            },

            status:
              "PENDING",
          },

          include: {
            performance: true,

            ticketOrders: {
              where: {
                status:
                  "PENDING",
              },

              include: {
                show: true,
              },
            },
          },
        });

      if (candidates.length === 1) {
        reservation =
          candidates[0];

        console.log(
          `✅ Extra Ticket Request matched by legacy email fallback: ${reservation.id}`,
        );
      } else if (
        candidates.length > 1
      ) {
        console.log(
          `⚠️ Multiple pending Extra Ticket Request reservations found for ${customerEmail}. Cannot safely choose one.`,
        );

        return new Response();
      }
    }
  }

  if (!reservation) {
    console.log(
      "⚠️ No matching Extra Ticket Request reservation was found.",
    );

    return new Response();
  }

  console.log(
    `✅ Extra Ticket reservation found: ${reservation.id}`,
  );

  const paidAt =
  new Date();

// ======================================
// CONFIRM RESERVATION FIRST
//
// Ticket generation needs to see this
// reservation as confirmed so existing
// customer tickets are counted correctly.
// ======================================

await prisma.reservation.update({
  where: {
    id:
      reservation.id,
  },

  data: {
    status:
      "CONFIRMED",
  },
});

// ======================================
// CONFIRM PENDING EXTRA TICKETS
// ======================================

const pendingTickets =
  reservation.ticketOrders;

  for (
    const ticket of
    pendingTickets
  ) {
    await prisma.ticketOrder.update({
      where: {
        id:
          ticket.id,
      },

      data: {
        status:
          "CONFIRMED",
      },
    });

    const showDate =
      ticket.show?.date;

    const shouldGenerateTicket =
      !showDate ||
      new Date(showDate) >
        paidAt;

    if (shouldGenerateTicket) {
      await generateTicketAssets(
        ticket.id,
      );
    } else {
      console.log(
        `⏭️ Skipping ticket generation for past show ${ticket.show?.name}`,
      );
    }
  }

  // ======================================
  // MARK REQUEST CLAIMED
  // ======================================

  if (
    reservation.extraTicketRequestId
  ) {
    await prisma.waitlistEntry.update({
      where: {
        id:
          reservation.extraTicketRequestId,
      },

      data: {
        status:
          "CLAIMED",

        claimedAt:
          paidAt,

        offerExpiresAt:
          null,
      },
    });
  }

  console.log(
    `✅ Extra Ticket Request ${reservation.extraTicketRequestId} claimed and paid.`,
  );

  return new Response();
}

  // ======================================
  // Prevent duplicate credit-card webhook
  // processing if Shopify retries it
  // ======================================

  const existing =
    await prisma.ticketOrder.findFirst({
      where: {
        shopifyOrderId:
          payload.id.toString(),
      },
    });

  if (existing) {
    console.log(
      `⏭️ Shopify order ${payload.name} has already been processed.`,
    );

    return new Response();
  }

  console.log(
    "=================================",
  );
  console.log(
    "🎉 ORDERS PAID WEBHOOK RECEIVED",
  );
  console.log(
    "=================================",
  );

  console.log("Shop:", shop);
  console.log("Topic:", topic);
  console.log("Order Number:", payload.name);
  console.log("Order ID:", payload.id);

  // Determine which IDA studio/store
  // received the Shopify order.
  const account =
    shop === "ida-dance-store.myshopify.com"
      ? "FW"
      : "PM";

  console.log("IDA Account:", account);

  const matchedShows = [];

  let performanceId = null;
  let performanceName = "";
  let includesVideo = false;
  let videoPrice = 15;

  for (const item of payload.line_items) {
    console.log({
      title: item.title,
      variantId: item.variant_id,
      quantity: item.quantity,
    });

    const result =
      await findShowByVariantId(
        item.variant_id.toString(),
      );

    if (!result) {
      console.log(
        "❌ Not an IDA Tickets product",
      );
      continue;
    }

    console.log("✅ MATCH FOUND");

    console.log({
      show: result.show.name,
      performance:
        result.show.performance.name,
      type: result.type,
    });

    if (result.type === "ticket") {
      matchedShows.push({
        showId: result.show.id,
        name: result.show.name,
        quantity: item.quantity,
        ticketPrice:
          result.show.boxOffice
            ?.ticketPrice ?? 15,
      });

      performanceId =
        result.show.performanceId;

      performanceName =
        result.show.performance.name;
    }

    if (result.type === "video") {
  includesVideo = true;

  videoPrice =
    result.show.boxOffice
      ?.digitalVideoPrice ?? 15;

  performanceId =
    result.show.performanceId;

  performanceName =
    result.show.performance.name;
}
  }

if (
  matchedShows.length > 0 ||
  includesVideo
) {
      const order = {
      firstName:
        payload.customer?.first_name ??
        "Customer",

      lastName:
        payload.customer?.last_name ??
        "",

      email:
        payload.customer?.email ??
        payload.email ??
        "",

      account,

      performanceId,
      performanceName,

      shows: matchedShows,

      video: includesVideo,
      videoPrice,
    };

    // ======================================
    // Create confirmed IDA reservation
    // ======================================

    const reservation =
      await createReservation({
        order,

        paymentMethod: "CREDIT_CARD",

        status: "CONFIRMED",

        shopifyOrderId:
          payload.id.toString(),

        shopifyOrderNumber:
          payload.name,
      });

      // ======================================
// Prepare customer Google Drive folder
//
// This must happen independently of
// ticket generation so video-only
// purchases also receive their
// Performance Videos shortcut.
// ======================================

const performance =
  await prisma.performance.findUnique({
    where: {
      id: order.performanceId,
    },
  });

if (!performance) {
  throw new Error(
    "Performance not found.",
  );
}

console.log(
  "EXTRA TICKET DEBUG:",
  {
    performanceId: performance.id,
    performanceName: performance.name,
    extraTicketRequestsEnabled:
      performance.extraTicketRequestsEnabled,
  },
);

await prepareCustomerFolder(
  performance,
  reservation,
  order.video,
);

    // ======================================
    // Create tickets + PDFs
    // ======================================

    await createTicketOrders({
      order,

      paymentMethod: "CREDIT_CARD",

      status: "CONFIRMED",

      shopifyOrderId:
        payload.id.toString(),

      shopifyOrderNumber:
        payload.name,

      reservationId:
        reservation.id,
    });

    // ======================================
    // Reload reservation to get Drive link
    // ======================================

    const updatedReservation =
      await prisma.reservation.findUnique({
        where: {
          id: reservation.id,
        },
      });

    if (
      !updatedReservation?.driveFolderLink
    ) {
      throw new Error(
        "Customer Google Drive folder link was not created.",
      );
    }

   // ======================================
// Send customer ticket-folder email
// ======================================

try {
  await sendPaidTicketConfirmation({
    order,
    driveFolderLink:
      updatedReservation.driveFolderLink,
    reservationId: reservation.id,
    extraTicketRequestsEnabled:
      performance.extraTicketRequestsEnabled,
  });

  // Only stamp ticketsSentAt after
  // SendGrid successfully accepts email.
  await prisma.reservation.update({
    where: {
      id: reservation.id,
    },
    data: {
      ticketsSentAt: new Date(),
    },
  });

  console.log(
    `✅ Ticket delivery completed for ${payload.name}`,
  );
} catch (emailError) {
  console.error(
    "⚠️ Tickets were created, but ticket email failed:",
    emailError,
  );

  // IMPORTANT:
  // Don't fail the Shopify webhook here.
  // ticketsSentAt stays null, so this
  // customer can appear in Ready to Send.
}

}

console.log(
  "=================================",
);

return new Response();
};