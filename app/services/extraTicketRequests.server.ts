import prisma from "../db.server";

import {
  ensureSeatsAvailable,
} from "./showValidation.server";

import {
  createReservation,
  createTicketOrders,
} from "./ticketOrders.server";

export async function approveExtraTicketRequest({
  requestId,
  account,
  admin,
}: {
  requestId: string;
  account: "FW" | "PM";
  admin: any;
}) {
  const request =
    await prisma.waitlistEntry.findUnique({
      where: {
        id: requestId,
      },

      include: {
        show: {
          include: {
            performance: true,
            boxOffice: true,
          },
        },
      },
    });

  if (!request) {
    throw new Error(
      "Extra ticket request was not found.",
    );
  }

  if (
    request.type !==
    "EXTRA_TICKETS"
  ) {
    throw new Error(
      "This is not an Extra Ticket Request.",
    );
  }

  if (
    request.status !==
    "WAITING"
  ) {
    throw new Error(
      "This Extra Ticket Request has already been handled.",
    );
  }

  if (
    request.account !== account
  ) {
    throw new Error(
      "This request belongs to another studio.",
    );
  }

  await ensureSeatsAvailable({
  ignoreTicketLimit: true,

  shows: [
    {
      showId:
        request.showId,

      quantity:
        request.quantity,
    },
  ],
});

    // ======================================
  // BUILD EXTRA-TICKET ORDER
  // ======================================

  const ticketVariantId =
    account === "FW"
      ? request.show
          .fwCreditTicketVariantId
      : request.show
          .pmCreditTicketVariantId;

  if (!ticketVariantId) {
    throw new Error(
      "No credit-card ticket product is configured for this show.",
    );
  }

  const baseTicketPrice =
    request.show.boxOffice
      ?.ticketPrice ?? 15;

  const creditCardFeePercent =
    request.show.boxOffice
      ?.creditCardFeePercent ?? 2.6;

  const creditTicketPrice =
    Math.round(
      baseTicketPrice *
        (1 +
          creditCardFeePercent /
            100) *
        100,
    ) / 100;

  const lineItems = [
    {
      variantId:
        `gid://shopify/ProductVariant/${ticketVariantId}`,

      quantity:
        request.quantity,
    },
  ];

  // ======================================
  // CREATE SHOPIFY DRAFT ORDER
  // ======================================

  const response =
    await admin.graphql(
      `#graphql
        mutation DraftOrderCreate(
          $input: DraftOrderInput!
        ) {
          draftOrderCreate(
            input: $input
          ) {
            draftOrder {
              id
              name
              invoiceUrl
              ready
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
            email:
              request.customerEmail,

            lineItems,

            tags: [
  "IDA Tickets",
  "Extra Ticket Request",
`ETR:${request.id}`,
  account === "FW"
    ? "Fort Washington"
    : "Plymouth Meeting",
  request.show.performance.name,
],

            note:
              `Extra Ticket Request\n\n` +
              `Customer: ${request.customerName}\n` +
              `Performance: ${request.show.performance.name}\n` +
              `Show: ${request.show.name}\n` +
              `Tickets: ${request.quantity}`,
          },
        },
      },
    );

  const json =
    await response.json();

  if (json.errors) {
    throw new Error(
      JSON.stringify(
        json.errors,
        null,
        2,
      ),
    );
  }

  const result =
    json.data
      ?.draftOrderCreate;

  if (!result) {
    throw new Error(
      "Shopify returned no draft order result.",
    );
  }

  if (
    result.userErrors
      ?.length > 0
  ) {
    throw new Error(
      result.userErrors
        .map(
          (error: any) =>
            error.message,
        )
        .join(", "),
    );
  }

  // ======================================
  // CREATE PENDING IDA RESERVATION
  // ======================================

  const nameParts =
    request.customerName
      .trim()
      .split(/\s+/);

  const firstName =
    nameParts.shift() ??
    "Customer";

  const lastName =
    nameParts.join(" ");

  const order = {
    firstName,
    lastName,

    email:
      request.customerEmail,

    account,

    performanceId:
      request.show.performanceId,

    performanceName:
      request.show.performance.name,

    shows: [
      {
        showId:
          request.show.id,

        id:
          request.show.id,

        name:
          request.show.name,

        quantity:
          request.quantity,

        ticketPrice:
          creditTicketPrice,
      },
    ],

    video: false,
    videoPrice: 0,
  };

  const reservation =
    await createReservation({
      order,

      paymentMethod:
        "CREDIT_CARD",

      status:
        "PENDING",

      shopifyOrderId:
        result.draftOrder.id,

      shopifyOrderNumber:
        result.draftOrder.name,
    });

  await prisma.reservation.update({
    where: {
      id:
        reservation.id,
    },

    data: {
      extraTicketRequestId:
        request.id,
    },
  });

  await createTicketOrders({
    order,

    paymentMethod:
      "CREDIT_CARD",

    status:
      "PENDING",

    shopifyOrderId:
      result.draftOrder.id,

    shopifyOrderNumber:
      result.draftOrder.name,

    reservationId:
      reservation.id,
  });

  // ======================================
  // WAIT FOR SHOPIFY CALCULATION
  // ======================================

  let draftOrderReady =
    result.draftOrder
      ?.ready === true;

  for (
    let attempt = 0;
    attempt < 10 &&
    !draftOrderReady;
    attempt++
  ) {
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          500,
        ),
    );

    const readyResponse =
      await admin.graphql(
        `#graphql
          query DraftOrderReady(
            $id: ID!
          ) {
            draftOrder(
              id: $id
            ) {
              id
              ready
            }
          }
        `,
        {
          variables: {
            id:
              result.draftOrder.id,
          },
        },
      );

    const readyJson =
      await readyResponse.json();

    draftOrderReady =
      readyJson.data
        ?.draftOrder
        ?.ready === true;
  }

  if (!draftOrderReady) {
    throw new Error(
      "Shopify is still calculating this invoice. Please try again.",
    );
  }

  // ======================================
  // SEND INVOICE
  // ======================================

  const invoiceResponse =
  await admin.graphql(
    `#graphql
      mutation DraftOrderInvoiceSend(
        $id: ID!,
        $email: EmailInput
      ) {
        draftOrderInvoiceSend(
          id: $id,
          email: $email
        ) {
          draftOrder {
            id
            name
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
        id:
          result.draftOrder.id,

        email: {
          to:
            request.customerEmail,

          subject:
            `Your Extra Ticket Request Is Ready – ${request.show.performance.name}`,

          customMessage:
            `Good news! Your request for ${request.quantity} additional ticket${
              request.quantity === 1
                ? ""
                : "s"
            } to ${request.show.name} has been approved. ` +
            `Please complete payment using the button below within 24 hours. ` +
            `Once payment is completed, your extra ticket${
              request.quantity === 1
                ? ""
                : "s"
            } will be issued automatically.`,
        },
      },
    },
  );

  const invoiceJson =
    await invoiceResponse.json();

  if (invoiceJson.errors) {
    throw new Error(
      JSON.stringify(
        invoiceJson.errors,
        null,
        2,
      ),
    );
  }

  const invoiceResult =
    invoiceJson.data
      ?.draftOrderInvoiceSend;

  if (
    !invoiceResult ||
    invoiceResult.userErrors
      ?.length > 0
  ) {
    throw new Error(
      invoiceResult?.userErrors
        ?.map(
          (error: any) =>
            error.message,
        )
        .join(", ") ||
        "The invoice could not be sent.",
    );
  }

 // ======================================
// MARK REQUEST OFFERED
// HOLD FOR 24 HOURS
// ======================================

const offeredAt =
  new Date();

const offerExpiresAt =
  new Date(
    offeredAt.getTime() +
      24 *
        60 *
        60 *
        1000,
  );

await prisma.waitlistEntry.update({
  where: {
    id:
      request.id,
  },

  data: {
    status:
      "OFFERED",

    offeredAt,

    offerExpiresAt,
  },
});

  return {
    success: true,

    requestId:
      request.id,

    reservationId:
      reservation.id,

    draftOrderId:
      result.draftOrder.id,

    invoiceUrl:
      result.draftOrder.invoiceUrl,
  };
}
export async function expireExtraTicketOffers({
  admin,
  performanceId,
}: {
  admin: any;
  performanceId: string;
}) {
  const now =
    new Date();

  const expiredRequests =
    await prisma.waitlistEntry.findMany({
      where: {
        type:
          "EXTRA_TICKETS",

        status:
          "OFFERED",

        offerExpiresAt: {
          lte: now,
        },

        show: {
          performanceId,
        },
      },
    });

  for (
    const request of
    expiredRequests
  ) {
    const reservation =
      await prisma.reservation.findFirst({
        where: {
          extraTicketRequestId:
            request.id,

          status:
            "PENDING",
        },

        include: {
          ticketOrders: {
            where: {
              status:
                "PENDING",
            },
          },
        },
      });

    // ======================================
    // REMOVE UNPAID SHOPIFY DRAFT ORDER
    //
    // This prevents an expired invoice
    // link from being paid later.
    // ======================================

    if (
  reservation?.shopifyOrderId
) {
  const deleteResponse =
    await admin.graphql(
      `#graphql
        mutation DraftOrderDelete(
          $input: DraftOrderDeleteInput!
        ) {
          draftOrderDelete(
            input: $input
          ) {
            deletedId

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
            id:
              reservation.shopifyOrderId,
          },
        },
      },
    );

  const deleteJson =
    await deleteResponse.json();

  if (deleteJson.errors) {
    console.error(
      "EXPIRED EXTRA TICKET DRAFT ORDER DELETE FAILED",
      deleteJson.errors,
    );

    // Do NOT release the seats while the
    // customer's invoice may still be payable.
    continue;
  }

  const deleteErrors =
    deleteJson.data
      ?.draftOrderDelete
      ?.userErrors ?? [];

  if (
    deleteErrors.length > 0
  ) {
    console.error(
      "EXPIRED EXTRA TICKET DRAFT ORDER DELETE FAILED",
      deleteErrors,
    );

    // Do NOT release the seats while the
    // customer's invoice may still be payable.
    continue;
  }
}

    // ======================================
    // RELEASE RESERVED TICKETS
    // ======================================

    if (reservation) {
      await prisma.ticketOrder.updateMany({
        where: {
          reservationId:
            reservation.id,

          status:
            "PENDING",
        },

        data: {
          status:
            "CANCELED",
        },
      });

      await prisma.reservation.update({
        where: {
          id:
            reservation.id,
        },

        data: {
          status:
            "CANCELLED",
        },
      });
    }

    // ======================================
    // EXPIRE REQUEST
    // ======================================

    await prisma.waitlistEntry.update({
      where: {
        id:
          request.id,
      },

      data: {
        status:
          "EXPIRED",
      },
    });

    console.log(
      `⏰ Extra Ticket Request ${request.id} expired and seats were released.`,
    );
  }

  return {
    expired:
      expiredRequests.length,
  };
}