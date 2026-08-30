import prisma from "../db.server";

export async function findShowByVariantId(variantId) {  // First, look for a ticket variant on a Show
  const show = await prisma.show.findFirst({
    where: {
      OR: [
        { fwCheckTicketVariantId: variantId },
        { fwCreditTicketVariantId: variantId },

        { pmCheckTicketVariantId: variantId },
        { pmCreditTicketVariantId: variantId },

        { shopifyCheckTicketVariantId: variantId },
        { shopifyCreditTicketVariantId: variantId },
      ],
    },
    include: {
      performance: true,
      boxOffice: true,
    },
  });

  if (show) {
    return {
      show,
      type: "ticket",
    };
  }

  // If it wasn't a ticket, look for a Performance video variant
  const performance = await prisma.performance.findFirst({
    where: {
      OR: [
        { fwCheckVideoVariantId: variantId },
        { fwCreditVideoVariantId: variantId },

        { pmCheckVideoVariantId: variantId },
        { pmCreditVideoVariantId: variantId },
      ],
    },
    include: {
      shows: {
        include: {
          boxOffice: true,
        },
        orderBy: {
          date: "asc",
        },
        take: 1,
      },
    },
  });

  if (!performance || performance.shows.length === 0) {
    return null;
  }

  return {
    show: {
      ...performance.shows[0],
      performance,
    },
    type: "video",
  };
}