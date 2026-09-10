import prisma from "../db.server";

export async function findEventLocationByVariantId(
  variantId,
) {
  if (!variantId) {
    return null;
  }

  const id = String(variantId);

  const location =
    await prisma.eventLocation.findFirst({
      where: {
        OR: [
          {
            creditVariantId: id,
          },
          {
            checkVariantId: id,
          },
        ],
      },

      include: {
        event: true,
      },
    });

  if (!location) {
    return null;
  }

  const paymentMethod =
    location.creditVariantId === id
      ? "CREDIT_CARD"
      : "CHECK";

  return {
    location,
    event: location.event,
    paymentMethod,
  };
}