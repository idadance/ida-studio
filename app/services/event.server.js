import prisma from "../db.server";

// Get all events
export async function getEvents() {
  return prisma.event.findMany({
    include: {
      reservations: true,
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
      reservations: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

// Create an event
export async function createEvent({
  name,
  description,
  date,
  location,
  capacity,
  price,
  creditCardEnabled = true,
  checkEnabled = true,
}) {
  return prisma.event.create({
    data: {
      name,
      description: description || null,
      date: date ? new Date(date) : null,
      location: location || null,
      capacity: Number(capacity),
      price: Number(price),
      creditCardEnabled,
      checkEnabled,
    },
  });
}

// Update an event
export async function updateEvent(id, data) {
  return prisma.event.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && {
        description: data.description || null,
      }),
      ...(data.date !== undefined && {
        date: data.date ? new Date(data.date) : null,
      }),
      ...(data.location !== undefined && {
        location: data.location || null,
      }),
      ...(data.capacity !== undefined && {
        capacity: Number(data.capacity),
      }),
      ...(data.price !== undefined && {
        price: Number(data.price),
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

// Calculate how many spots are currently reserved
export function getReservedQuantity(event) {
  return event.reservations
    .filter(
      (reservation) =>
        reservation.status === "PENDING" ||
        reservation.status === "CONFIRMED",
    )
    .reduce((total, reservation) => total + reservation.quantity, 0);
}

// Calculate remaining capacity
export function getRemainingCapacity(event) {
  return Math.max(0, event.capacity - getReservedQuantity(event));
}