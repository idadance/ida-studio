import prisma from "../db.server";

// Get all events
export async function getEvents() {
  return prisma.event.findMany({
    include: {
      locations: {
        include: {
          reservations: true,
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
}

// Get one event
export async function getEvent(id) {
  return prisma.event.findUnique({
    where: { id },
    include: {
      locations: {
        include: {
          reservations: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          studioCode: "asc",
        },
      },
    },
  });
}

// Create an event with one or more studio locations
export async function createEvent({
  name,
  description,
  date,
  creditCardEnabled = true,
  checkEnabled = true,
  locations,
}) {
  return prisma.event.create({
    data: {
      name,
      description: description || null,
      date: date ? new Date(date) : null,
      creditCardEnabled,
      checkEnabled,

      locations: {
        create: locations.map((location) => ({
          studioCode: location.studioCode,
          name: location.name,
          capacity: Number(location.capacity),
          price: Number(location.price),
        })),
      },
    },
    include: {
      locations: true,
    },
  });
}

// Update basic event information
export async function updateEvent(id, data) {
  return prisma.event.update({
    where: { id },
    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.description !== undefined && {
        description: data.description || null,
      }),

      ...(data.date !== undefined && {
        date: data.date ? new Date(data.date) : null,
      }),

      ...(data.status !== undefined && {
        status: data.status,
      }),

      ...(data.creditCardEnabled !== undefined && {
        creditCardEnabled: data.creditCardEnabled,
      }),

      ...(data.checkEnabled !== undefined && {
        checkEnabled: data.checkEnabled,
      }),
    },
  });
}

// Update one event location
export async function updateEventLocation(id, data) {
  return prisma.eventLocation.update({
    where: { id },
    data: {
      ...(data.capacity !== undefined && {
        capacity: Number(data.capacity),
      }),

      ...(data.price !== undefined && {
        price: Number(data.price),
      }),
    },
  });
}

// Calculate how many spots are reserved at one location
export function getReservedQuantity(location) {
  return location.reservations
    .filter(
      (reservation) =>
        reservation.status === "PENDING" ||
        reservation.status === "CONFIRMED",
    )
    .reduce(
      (total, reservation) => total + reservation.quantity,
      0,
    );
}

// Calculate remaining capacity at one location
export function getRemainingCapacity(location) {
  return Math.max(
    0,
    location.capacity - getReservedQuantity(location),
  );
}

// Get capacity information for an entire event
export function getEventCapacitySummary(event) {
  const locations = event.locations.map((location) => {
    const reservedQuantity = getReservedQuantity(location);
    const remainingCapacity = Math.max(
      0,
      location.capacity - reservedQuantity,
    );

    return {
      id: location.id,
      studioCode: location.studioCode,
      name: location.name,
      capacity: location.capacity,
      price: location.price,
      reservedQuantity,
      remainingCapacity,
    };
  });

  return {
    locations,
    totalCapacity: locations.reduce(
      (total, location) => total + location.capacity,
      0,
    ),
    totalReserved: locations.reduce(
      (total, location) => total + location.reservedQuantity,
      0,
    ),
    totalRemaining: locations.reduce(
      (total, location) => total + location.remainingCapacity,
      0,
    ),
  };
}