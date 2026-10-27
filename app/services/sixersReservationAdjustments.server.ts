import prisma from "../db.server";
import type { Prisma } from "@prisma/client";

type CreateSixersAdjustmentInput = {
  reservationId: string;
  newTicketTierId: string;
  newQuantity: number;
  account: "FW" | "PM";
};

export async function createSixersReservationAdjustment({
  reservationId,
  newTicketTierId,
  newQuantity,
  account,
}: CreateSixersAdjustmentInput) {
  if (!reservationId || !newTicketTierId) {
    throw new Error("Missing reservation or ticket tier.");
  }

  if (!["FW", "PM"].includes(account)) {
    throw new Error("Invalid studio.");
  }

  if (
    !Number.isSafeInteger(newQuantity) ||
    newQuantity < 1
  ) {
    throw new Error("Please enter a valid ticket quantity.");
  }

  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Lock the original reservation and target tier.
      // The tier lock coordinates with public checkout.
      await tx.$queryRaw`
        SELECT "id"
        FROM "EventTicketTier"
        WHERE "id" = ${newTicketTierId}
        FOR UPDATE
      `;

      await tx.$queryRaw`
  SELECT "id"
  FROM "EventReservation"
  WHERE "id" = ${reservationId}
  FOR UPDATE
`;

      const reservation =
        await tx.eventReservation.findUnique({
          where: { id: reservationId },
          include: {
            eventLocation: true,
            ticketTier: true,
          },
        });

      if (
        !reservation ||
        !reservation.ticketTier ||
        reservation.eventLocation.studioCode !== account ||
        reservation.status !== "CONFIRMED"
      ) {
        throw new Error(
          "Only confirmed Sixers reservations from the correct studio can be edited.",
        );
      }

      if (reservation.ticketTierId === newTicketTierId) {
        if (newQuantity <= reservation.quantity) {
          throw new Error(
            "The new quantity must be greater than the existing quantity.",
          );
        }
      } else if (newQuantity !== reservation.quantity) {
        throw new Error(
          "Ticket level changes must keep the same quantity.",
        );
      }

      const activeAdjustment =
        await tx.sixersReservationAdjustment.findFirst({
          where: {
            reservationId,
            status: { in: ["PENDING", "CREATING", "INVOICED", "SENDING", "SENT"] },
          },
        });

      if (activeAdjustment) {
        throw new Error(
          "This reservation already has an adjustment awaiting payment.",
        );
      }

      const targetTier =
        await tx.eventTicketTier.findUnique({
          where: { id: newTicketTierId },
        });

      if (
        !targetTier ||
        targetTier.eventId !== reservation.ticketTier.eventId
      ) {
        throw new Error(
          "The selected ticket tier does not belong to this event.",
        );
      }

      const additionalQuantity =
        reservation.ticketTierId === newTicketTierId
          ? newQuantity - reservation.quantity
          : newQuantity;

      const reserved =
        await tx.eventReservation.aggregate({
          where: {
            ticketTierId: newTicketTierId,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          _sum: { quantity: true },
        });

      const adjustmentHolds =
        await tx.sixersReservationAdjustment.aggregate({
          where: {
            newTicketTierId,
            status: { in: ["PENDING", "CREATING", "INVOICED", "SENDING", "SENT"] },
          },
          _sum: { newQuantity: true },
        });

      const remaining =
        targetTier.capacity -
        (reserved._sum.quantity || 0) -
        (adjustmentHolds._sum.newQuantity || 0);

      if (additionalQuantity > remaining) {
        throw new Error(
          `Only ${Math.max(0, remaining)} tickets remain at this price.`,
        );
      }

      const baseDifference =
        reservation.ticketTierId === newTicketTierId
          ? additionalQuantity * targetTier.price
          : newQuantity *
            (targetTier.price - reservation.ticketTier.price);

      if (baseDifference <= 0) {
        throw new Error(
          "This adjustment does not require an additional payment.",
        );
      }

      const creditPrice = (price: number) =>
  Math.round(price * 1.026 * 100) / 100;

const amountDue =
  reservation.ticketTierId === newTicketTierId
    ? additionalQuantity * creditPrice(targetTier.price)
    : newQuantity *
      (creditPrice(targetTier.price) -
        creditPrice(reservation.ticketTier.price));

      return tx.sixersReservationAdjustment.create({
        data: {
          reservationId,
          originalTicketTierId: reservation.ticketTierId,
          originalQuantity: reservation.quantity,
          newTicketTierId,
          // Store only additional tickets needed for inventory holds.
          newQuantity: additionalQuantity,
          amountDue,
          status: "PENDING",
        },
      });
    },
  );
}
export async function createSixersAdjustmentInvoice(
  admin: any,
  adjustmentId: string,
  account: "FW" | "PM",
) {
  if (!adjustmentId?.trim()) {
    throw new Error("Missing Sixers adjustment ID.");
  }

  const adjustment = await prisma.sixersReservationAdjustment.findUnique({
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
  
  const reservationAccount =
  adjustment.reservation.eventLocation.studioCode;

  if (reservationAccount !== account) {
  throw new Error(
    "This Sixers reservation belongs to a different studio.",
  );
}

if (!["FW", "PM"].includes(reservationAccount)) {
  throw new Error(
    "Unable to identify the studio for this Sixers reservation.",
  );
}

  if (adjustment.status !== "PENDING") {
    throw new Error(
      "This adjustment is already being processed or invoiced.",
    );
  }

  if (!adjustment.reservation.customerEmail) {
    throw new Error("The reservation has no customer email.");
  }

  if (adjustment.amountDue <= 0) {
    throw new Error("The adjustment has no amount due.");
  }

  // Atomically claim the adjustment before contacting Shopify.
  const claimed = await prisma.sixersReservationAdjustment.updateMany({
    where: {
      id: adjustmentId,
      status: "PENDING",
    },
    data: {
      status: "CREATING",
    },
  });

  if (claimed.count !== 1) {
    throw new Error(
      "An invoice is already being created for this adjustment.",
    );
  }

    try {
    const targetTier = await prisma.eventTicketTier.findUnique({
      where: { id: adjustment.newTicketTierId },
    });

    if (!targetTier) {
      throw new Error("The new ticket tier was not found.");
    }

    const amountDue = Number(adjustment.amountDue);

    if (!Number.isFinite(amountDue) || amountDue <= 0) {
      throw new Error("Invalid adjustment amount.");
    }

    const isUpgrade =
      adjustment.originalTicketTierId !==
      adjustment.newTicketTierId;

    const description = isUpgrade
      ? `Sixers Ticket Upgrade - ${adjustment.newQuantity} tickets`
      : `Sixers Additional Tickets - ${adjustment.newQuantity} tickets`;

  // Claim this invoice before contacting Shopify.
  // Only one request can change INVOICED to SENDING.
  const claimed = await prisma.sixersReservationAdjustment.updateMany({
    where: {
      id: adjustmentId,
      status: "INVOICED",
    },
    data: {
      status: "SENDING",
    },
  });

  if (claimed.count !== 1) {
    throw new Error(
      "This invoice is already being sent or has been sent.",
    );
  }

    const response = await admin.graphql(
      `#graphql
        mutation CreateSixersAdjustmentDraft($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
              name
              totalPrice
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
            email: adjustment.reservation.customerEmail,
            lineItems: [
              {
                title: description,
                quantity: 1,
                originalUnitPrice: amountDue.toFixed(2),
                taxable: false,
              },
            ],
            tags: [
              "Sixers Ticket Sale",
              "Sixers Adjustment",
              `SIXERS_ADJ:${adjustment.id}`,
              account === "FW"
                ? "Fort Washington"
                : "Plymouth Meeting",
            ],
            note:
              `Sixers Reservation Adjustment\n` +
              `Adjustment: ${adjustment.id}\n` +
              `Original Reservation: ${adjustment.reservationId}\n` +
              `Customer: ${adjustment.reservation.customerName}\n` +
              `Amount Due: $${amountDue.toFixed(2)}`,
          },
        },
      },
    );

    const json = await response.json();

    if (json.errors?.length) {
      throw new Error(JSON.stringify(json.errors));
    }

    const result = json.data?.draftOrderCreate;

    if (result?.userErrors?.length) {
      throw new Error(
        result.userErrors
          .map((error: { message: string }) => error.message)
          .join(", "),
      );
    }

    const draft = result?.draftOrder;

    if (!draft?.id) {
      throw new Error("Shopify did not return a draft order.");
    }

    const shopifyTotal = Number(draft.totalPrice);

    if (
      !Number.isFinite(shopifyTotal) ||
      Math.round(shopifyTotal * 100) !==
        Math.round(amountDue * 100)
    ) {
      throw new Error(
        `Invoice total mismatch: expected $${amountDue.toFixed(2)}, Shopify returned $${draft.totalPrice}.`,
      );
    }

    await prisma.sixersReservationAdjustment.update({
      where: { id: adjustmentId },
      data: {
        shopifyDraftOrderId: draft.id,
        status: "INVOICED",
      },
    });

    return {
      adjustmentId,
      draftOrderId: draft.id,
      draftOrderName: draft.name,
      invoiceUrl: draft.invoiceUrl,
      amountDue,
      status: "INVOICED",
    };
  } catch (error) {
    // Keep CREATING for manual review.
    // Shopify may have created a draft before an error occurred.
    console.error(
      "Sixers adjustment invoice requires review:",
      adjustmentId,
      error,
    );

    throw new Error(
      "The invoice could not be verified. Please review the Shopify draft orders before trying again.",
    );
  }
}


export async function sendSixersAdjustmentInvoice(
  admin: any,
  adjustmentId: string,
  account: "FW" | "PM",
) {
  const adjustment =
    await prisma.sixersReservationAdjustment.findUnique({
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
      "This adjustment belongs to a different studio.",
    );
  }

  if (adjustment.status !== "INVOICED") {
    throw new Error(
      "Only unpaid, prepared Sixers invoices can be sent.",
    );
  }

  if (!adjustment.shopifyDraftOrderId) {
    throw new Error(
      "This adjustment does not have a Shopify draft order.",
    );
  }

  const email = adjustment.reservation.customerEmail;

  if (!email) {
    throw new Error(
      "The reservation does not have a customer email.",
    );
  }

  const isUpgrade =
    adjustment.originalTicketTierId !==
    adjustment.newTicketTierId;

  const description = isUpgrade
    ? "your Sixers ticket upgrade"
    : `${adjustment.newQuantity} additional Sixers ticket${
        adjustment.newQuantity === 1 ? "" : "s"
      }`;

  const response = await admin.graphql(
    `#graphql
      mutation SendSixersAdjustmentInvoice(
        $id: ID!
        $email: EmailInput
      ) {
        draftOrderInvoiceSend(id: $id, email: $email) {
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
        id: adjustment.shopifyDraftOrderId,
        email: {
          to: email,
          subject: "Your Sixers Ticket Invoice",
          customMessage:
            `Your invoice for ${description} is ready. ` +
            `The amount due is $${adjustment.amountDue.toFixed(2)}. ` +
            `Please use the payment button below to complete your purchase. ` +
            `Your ticket changes will be confirmed once payment is verified.`,
        },
      },
    },
  );

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(JSON.stringify(json.errors));
  }

  const result = json.data?.draftOrderInvoiceSend;

  if (!result || result.userErrors?.length) {
    throw new Error(
      result?.userErrors
        ?.map((error: { message: string }) => error.message)
        .join(", ") || "The invoice could not be sent.",
    );
  }

    // Shopify accepted the invoice-send request.
  // Do not overwrite PAID if the payment webhook arrived first.
  await prisma.sixersReservationAdjustment.updateMany({
    where: {
      id: adjustmentId,
      status: "SENDING",
    },
    data: {
      status: "SENT",
    },
  });

  return {
    success: true,
    adjustmentId,
    draftOrderId: result.draftOrder?.id,
  };
}
