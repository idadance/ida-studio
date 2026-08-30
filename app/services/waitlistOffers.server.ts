import prisma from "../db.server";

const OFFER_HOURS = 24;

export async function offerReleasedSeats({
  showId,
  releasedQuantity,
}: {
  showId: string;
  releasedQuantity: number;
}) {
  if (releasedQuantity <= 0) {
    return {
      offered: [],
      remainingQuantity: 0,
    };
  }

  let remainingQuantity =
    releasedQuantity;

  const offered = [];

  // ======================================
  // GET WAITLIST IN FIRST-COME ORDER
  // ======================================

  const waitingEntries =
    await prisma.waitlistEntry.findMany({
      where: {
  showId,
  status: "WAITING",
  type: "SOLD_OUT",
},

      orderBy: {
  requestedAt: "asc",
},
    });

  // ======================================
  // OFFER RELEASED SEATS
  //
  // Only offer tickets when we can
  // satisfy the family's full request.
  // We do not partially fill requests.
  // ======================================

  for (const entry of waitingEntries) {
    if (remainingQuantity <= 0) {
      break;
    }

    if (
      entry.quantity >
      remainingQuantity
    ) {
      continue;
    }

    const offeredAt =
      new Date();

    const offerExpiresAt =
      new Date(
        offeredAt.getTime() +
          OFFER_HOURS *
            60 *
            60 *
            1000,
      );

    const updatedEntry =
      await prisma.waitlistEntry.update({
        where: {
          id: entry.id,
        },

        data: {
          status: "OFFERED",
          offeredAt,
          offerExpiresAt,
        },
      });

    offered.push(updatedEntry);

    remainingQuantity -=
      entry.quantity;
  }

  return {
    offered,
    remainingQuantity,
  };
}