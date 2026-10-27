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
            status: { in: ["PENDING", "INVOICED"] },
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
            status: { in: ["PENDING", "INVOICED"] },
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

  // The Shopify draft-order creation will be added next.
  return {
    adjustmentId,
    status: "CREATING",
  };
}