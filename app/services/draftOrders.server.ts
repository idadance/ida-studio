import prisma from "../db.server";
import {
  createReservation,
  createTicketOrders,
} from "./ticketOrders.server";
import { ensureSeatsAvailable } from "./showValidation.server";
import { prepareCustomerFolder } from "./googleDrive.server";
import { sendCheckReservationConfirmation } from "./email.server";

export async function createDraftOrder(
  admin: any,
  order: any,
) {

  await ensureSeatsAvailable(order);
  console.log("✅ Seats validated");
  const lineItems = [];
  console.log("ORDER:");
console.log(JSON.stringify(order, null, 2));

// Ticket line items
for (const show of order.shows) {
  const variantId =
    order.account === "FW"
      ? show.fwCheckTicketVariantId
      : show.pmCheckTicketVariantId;

  lineItems.push({
    variantId: `gid://shopify/ProductVariant/${variantId}`,
    quantity: show.quantity,
  });
}

  // Digital Video
if (order.video) {
  const videoVariantId =
    order.account === "FW"
      ? order.fwCheckVideoVariantId
      : order.pmCheckVideoVariantId;

  if (!videoVariantId) {
    throw new Error(
      "No video product has been configured for this performance.",
    );
  }

  lineItems.push({
    variantId: `gid://shopify/ProductVariant/${videoVariantId}`,
    quantity: 1,
  });
}

  const customAttributes = [
    {
      key: "Customer Name",
      value: `${order.firstName} ${order.lastName}`,
    },
    {
      key: "Payment Method",
      value: "Check",
    },
    {
  key: "Performance",
  value: order.performanceName,
},
{
  key: "Studio",
  value:
    order.account === "FW"
      ? "Fort Washington"
      : "Plymouth Meeting",
},
{
  key: "Customer Email",
  value: order.email,
},
  ];

  if (order.notes?.trim()) {
    customAttributes.push({
      key: "Special Notes",
      value: order.notes,
    });
  }

  // Add one attribute for each selected show
  for (const show of order.shows) {
    customAttributes.push({
      key: show.name,
      value: `${show.quantity} ticket${show.quantity === 1 ? "" : "s"}`,
    });
  }

  console.log("LINE ITEMS");
console.log(JSON.stringify(lineItems, null, 2));

console.log("CUSTOM ATTRIBUTES");
console.log(JSON.stringify(customAttributes, null, 2));

console.log("✅ About to call draftOrderCreate");
console.log("=== DRAFT ORDER INPUT ===");
console.log(
  JSON.stringify(
    {
      lineItems,
      email: order.email,
      performanceId: order.performanceId,
      account: order.account,
    },
    null,
    2,
  ),
);
for (const item of lineItems) {
  console.log("Variant:", item.variantId);
}
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
          lineItems,

          email: order.email,

          tags: [
  "IDA Tickets",
  "Black Box",
  order.account === "FW"
    ? "Fort Washington"
    : "Plymouth Meeting",
  "Check Payment",
  order.performanceName,
  ...(order.video ? ["Digital Video"] : []),
],

          customAttributes,

          note: `
Customer: ${order.firstName} ${order.lastName}

Studio: ${
  order.account === "FW"
    ? "Fort Washington"
    : "Plymouth Meeting"
}

Performance: ${order.performanceName}

Payment Method: Check

${order.shows
  .map(
  (show: any) =>
      `${show.name}: ${show.quantity} ticket${
        show.quantity === 1 ? "" : "s"
      }`,
  )
  .join("\n")}

Digital Video: ${
  order.video ? "Yes" : "No"
}

${order.notes ? `Special Notes:\n${order.notes}` : ""}
`,
        },
      },
    },
  );

  const json = await response.json();

  console.log(JSON.stringify(json, null, 2));

  if (json.errors) {
  throw new Error(
    JSON.stringify(json.errors, null, 2),
  );
}

if (!json.data) {
  throw new Error(
    "Shopify returned no data:\n" +
      JSON.stringify(json, null, 2),
  );
}

  const result = json.data.draftOrderCreate;

  if (
    result.userErrors &&
    result.userErrors.length > 0
  ) {
    throw new Error(
      result.userErrors
        .map((e: any) => e.message)
        .join(", "),
    );
  }

 const reservation = await createReservation({
  order,
  paymentMethod: "CHECK",
  status: "PENDING",
  shopifyOrderId: result.draftOrder.id,
  shopifyOrderNumber: result.draftOrder.name,
});

const performance =
  await prisma.performance.findUnique({
    where: {
      id: order.performanceId,
    },
  });

if (!performance) {
  throw new Error("Performance not found.");
}

await prepareCustomerFolder(
  performance,
  reservation,
  order.video,
);

const updatedReservation =
  await prisma.reservation.findUnique({
    where: {
      id: reservation.id,
    },
  });

if (!updatedReservation?.driveFolderLink) {
  throw new Error(
    "Customer Google Drive folder link was not created.",
  );
}

await createTicketOrders({
  order,
  paymentMethod: "CHECK",
  status: "PENDING",
  shopifyOrderId: result.draftOrder.id,
  shopifyOrderNumber: result.draftOrder.name,
  reservationId: reservation.id,
});

try {
  await sendCheckReservationConfirmation({
    order,
    driveFolderLink:
      updatedReservation.driveFolderLink,
  });

  console.log(
    "✅ Check reservation confirmation email sent",
  );
} catch (emailError) {
  console.error(
    "⚠️ Reservation succeeded, but confirmation email failed:",
    emailError,
  );
}

  return {
  success: true,
  reservationId: reservation.id,

  draftOrderId: result.draftOrder.id,
  draftOrderName: result.draftOrder.name,
  invoiceUrl: result.draftOrder.invoiceUrl,
};
}

export async function sendUnpaidInvoice(
  admin: any,
  reservationId: string,
  account: "FW" | "PM",
) {
  const reservation =
    await prisma.reservation.findUnique({
      where: {
        id: reservationId,
      },

      include: {
        performance: true,

        ticketOrders: {
          where: {
            status: "PENDING",
          },

          include: {
            show: {
              include: {
                boxOffice: true,
              },
            },
          },
        },
      },
    });

  if (!reservation) {
    throw new Error(
      "Reservation not found.",
    );
  }

  if (reservation.account !== account) {
    throw new Error(
      "This reservation belongs to another studio.",
    );
  }

  if (!reservation.shopifyOrderId) {
    throw new Error(
      "Shopify Draft Order ID was not found.",
    );
  }

  // ======================================
  // GROUP UNPAID TICKETS BY SHOW
  // ======================================

  const showMap =
    new Map<
      string,
      {
        show: any;
        quantity: number;
      }
    >();

  for (
    const ticket of
    reservation.ticketOrders
  ) {
    const existing =
      showMap.get(
        ticket.showId,
      );

    if (existing) {
      existing.quantity +=
        ticket.quantity;
    } else {
      showMap.set(
        ticket.showId,
        {
          show:
            ticket.show,

          quantity:
            ticket.quantity,
        },
      );
    }
  }

  const lineItems: {
    variantId: string;
    quantity: number;
  }[] = [];

  // ======================================
  // UNPAID TICKET LINE ITEMS
  // ======================================

  for (
    const item of
    showMap.values()
  ) {
    const variantId =
  account === "FW"
    ? item.show
        .fwCreditTicketVariantId
    : item.show
        .pmCreditTicketVariantId;

    if (!variantId) {
      throw new Error(
        `No check ticket product is configured for ${item.show.name}.`,
      );
    }

    lineItems.push({
      variantId:
        `gid://shopify/ProductVariant/${variantId}`,

      quantity:
        item.quantity,
    });
  }

  // ======================================
  // UNPAID DIGITAL VIDEO
  // ======================================

  if (
    reservation.digitalVideo &&
    !reservation.digitalVideoPaid
  ) {
    const videoVariantId =
  account === "FW"
    ? reservation.performance
        .fwCreditVideoVariantId
    : reservation.performance
        .pmCreditVideoVariantId;

    if (!videoVariantId) {
      throw new Error(
        "No Digital Video product is configured for this performance.",
      );
    }

    lineItems.push({
      variantId:
        `gid://shopify/ProductVariant/${videoVariantId}`,

      quantity: 1,
    });
  }

  if (lineItems.length === 0) {
    throw new Error(
      "There are no unpaid items to invoice.",
    );
  }

  // ======================================
  // UPDATE THE EXISTING DRAFT ORDER
  // TO CONTAIN ONLY UNPAID ITEMS
  // ======================================

  const updateResponse =
    await admin.graphql(
      `#graphql
        mutation DraftOrderUpdate(
          $id: ID!,
          $input: DraftOrderInput!
        ) {
          draftOrderUpdate(
            id: $id,
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
          id:
            reservation.shopifyOrderId,

          input: {
            email:
              reservation.customerEmail,

            lineItems,
          },
        },
      },
    );

  const updateJson =
    await updateResponse.json();

  if (updateJson.errors) {
    throw new Error(
      JSON.stringify(
        updateJson.errors,
        null,
        2,
      ),
    );
  }

  const updateResult =
    updateJson.data
      ?.draftOrderUpdate;

  if (!updateResult) {
    throw new Error(
      "Shopify returned no draft order update result.",
    );
  }

  if (
    updateResult.userErrors
      ?.length > 0
  ) {
    throw new Error(
      updateResult.userErrors
        .map(
          (error: any) =>
            error.message,
        )
        .join(", "),
    );
  }

  // ======================================
  // WAIT FOR SHOPIFY TO FINISH
  // CALCULATING THE DRAFT ORDER
  // ======================================

  let draftOrderReady =
    updateResult.draftOrder
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
              reservation.shopifyOrderId,
          },
        },
      );

    const readyJson =
      await readyResponse.json();

    if (readyJson.errors) {
      throw new Error(
        JSON.stringify(
          readyJson.errors,
          null,
          2,
        ),
      );
    }

    draftOrderReady =
      readyJson.data
        ?.draftOrder
        ?.ready === true;
  }

  if (!draftOrderReady) {
    throw new Error(
      "Shopify is still calculating this invoice. Please try Send Invoice again.",
    );
  }

  // ======================================
  // SEND SHOPIFY INVOICE
  // ======================================

  const invoiceResponse =
    await admin.graphql(
      `#graphql
        mutation DraftOrderInvoiceSend(
          $id: ID!
        ) {
          draftOrderInvoiceSend(
            id: $id
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
            reservation.shopifyOrderId,
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

  if (!invoiceResult) {
    throw new Error(
      "Shopify returned no invoice result.",
    );
  }

  if (
    invoiceResult.userErrors
      ?.length > 0
  ) {
    throw new Error(
      invoiceResult.userErrors
        .map(
          (error: any) =>
            error.message,
        )
        .join(", "),
    );
  }

  return {
    success: true,

    reservationId:
      reservation.id,

    draftOrderId:
      reservation.shopifyOrderId,

    draftOrderName:
      invoiceResult.draftOrder
        ?.name,

    invoiceUrl:
      updateResult.draftOrder
        ?.invoiceUrl,
  };
}