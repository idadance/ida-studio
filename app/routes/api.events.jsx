import prisma from "../db.server";

export async function loader() {
  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
    },
    include: {
      locations: {
        include: {
          reservations: {
            where: {
              status: {
                in: ["PENDING", "CONFIRMED"],
              },
            },
          },
        },
        orderBy: {
          studioCode: "asc",
        },
      },
    },
    orderBy: {
      date: "asc",
    },
  });

  const result = events.map((event) => ({
    id: event.id,
name: event.name,
description: event.description,
imageUrl: event.imageUrl,
date: event.date,

    creditCardEnabled: event.creditCardEnabled,
    checkEnabled: event.checkEnabled,

    locations: event.locations.map((location) => {
      const reservedSpots = location.reservations.reduce(
        (total, reservation) =>
          total + reservation.quantity,
        0,
      );

      const remainingSpots = Math.max(
        0,
        location.capacity - reservedSpots,
      );

      return {
  id: location.id,
  studioCode: location.studioCode,
  name: location.name,
  capacity: location.capacity,
  remainingSpots,
  price: location.price,
  checkVariantId: location.checkVariantId,
  creditVariantId: location.creditVariantId,
};
    }),
  }));

  return Response.json(result);
}