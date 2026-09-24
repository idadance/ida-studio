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

export async function action({ request }) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const body = await request.json();

    const {
      eventLocationId,
      account,
      firstName,
      lastName,
      email,
      quantity,
      attendees,
    } = body;

    const eventQuantity = Number(quantity);

    const location =
      await prisma.eventLocation.findUnique({
        where: {
          id: eventLocationId,
        },

        include: {
          event: true,

          reservations: {
            where: {
              status: {
                in: ["PENDING", "CONFIRMED"],
              },
            },
          },
        },
      });

    if (!location) {
      return Response.json(
        { error: "Event location not found." },
        { status: 404 },
      );
    }

    if (location.event.status !== "PUBLISHED") {
      return Response.json(
        {
          error:
            "This event is not currently available.",
        },
        { status: 400 },
      );
    }

    if (location.studioCode !== account) {
      return Response.json(
        {
          error:
            "The selected event location does not match the selected studio.",
        },
        { status: 400 },
      );
    }

    if (!location.event.creditCardEnabled) {
      return Response.json(
        {
          error:
            "Credit card payment is not available for this event.",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(eventQuantity) ||
      eventQuantity < 1
    ) {
      return Response.json(
        {
          error:
            "Please select at least one spot.",
        },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(attendees) ||
      attendees.length !== eventQuantity
    ) {
      return Response.json(
        {
          error:
            "Please provide a dancer name and grade for each spot.",
        },
        { status: 400 },
      );
    }

    for (const attendee of attendees) {
      if (
        !attendee?.name?.trim() ||
        !attendee?.grade?.trim()
      ) {
        return Response.json(
          {
            error:
              "Please provide a dancer name and grade for each spot.",
          },
          { status: 400 },
        );
      }
    }

    if (
      !firstName?.trim() ||
      !lastName?.trim() ||
      !email?.trim()
    ) {
      return Response.json(
        {
          error:
            "Please provide your name and email address.",
        },
        { status: 400 },
      );
    }

    const reservedSpots =
      location.reservations.reduce(
        (total, reservation) =>
          total + reservation.quantity,
        0,
      );

    const remainingSpots = Math.max(
      0,
      location.capacity - reservedSpots,
    );

    if (eventQuantity > remainingSpots) {
      return Response.json(
        {
          error: `Only ${remainingSpots} spot${
            remainingSpots === 1 ? "" : "s"
          } remaining for ${location.name}.`,
        },
        { status: 400 },
      );
    }

    const reservation =
      await prisma.eventReservation.create({
        data: {
          eventLocationId: location.id,

          customerName:
            `${firstName.trim()} ${lastName.trim()}`,

          customerEmail: email.trim(),

          quantity: eventQuantity,

          paymentMethod: "CREDIT_CARD",

          status: "PENDING",

          totalAmount: Number(
            (
              eventQuantity *
              location.price *
              1.026
            ).toFixed(2),
          ),

          attendees: {
            create: attendees.map((attendee) => ({
              name: attendee.name.trim(),
              grade: attendee.grade.trim(),
            })),
          },
        },

        include: {
          attendees: true,
        },
      });

    console.log(
      `✅ Pending Event credit reservation created: ${reservation.id}`,
    );

    return Response.json({
      success: true,
      reservationId: reservation.id,
    });
  } catch (error) {
    console.error(
      "❌ Event credit reservation failed:",
      error,
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create event reservation.",
      },
      { status: 500 },
    );
  }
}