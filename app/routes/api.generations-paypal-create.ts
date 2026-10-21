import prisma from "../db.server";
import { createPayPalOrder } from "../services/paypal.server";

export async function action({
  request,
}: {
  request: Request;
}) {
  try {
    if (request.method !== "POST") {
      return Response.json(
        {
          error: "Method not allowed.",
        },
        {
          status: 405,
        },
      );
    }

    const body = await request.json();

    const showId =
      typeof body?.showId === "string"
        ? body.showId
        : "";

    const quantity = Number(
      body?.quantity,
    );

    const digitalVideo =
      body?.digitalVideo === true;

    if (
      !showId ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return Response.json(
        {
          error:
            "A valid show and ticket quantity are required.",
        },
        {
          status: 400,
        },
      );
    }

    const show =
      await prisma.show.findUnique({
        where: {
          id: showId,
        },

        include: {
          performance: true,

          boxOffice: true,

          ticketOrders: {
            where: {
              status: {
                not: "CANCELED",
              },
            },
          },

          waitlistEntries: {
            where: {
              status: "OFFERED",

              offerExpiresAt: {
                gt: new Date(),
              },
            },
          },
        },
      });

    if (!show) {
      return Response.json(
        {
          error: "Show not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      show.performance.organization !==
      "GENERATIONS"
    ) {
      return Response.json(
        {
          error:
            "This show is not available through Generations ticketing.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      show.performance.status !==
      "PUBLISHED"
    ) {
      return Response.json(
        {
          error:
            "This performance is not currently available.",
        },
        {
          status: 400,
        },
      );
    }

    if (!show.boxOffice?.salesOpen) {
      return Response.json(
        {
          error:
            "Ticket sales are not currently open.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      show.boxOffice.ticketLimitEnabled &&
      quantity >
        show.boxOffice.ticketLimit
    ) {
      return Response.json(
        {
          error: `A maximum of ${show.boxOffice.ticketLimit} tickets may be purchased at one time.`,
        },
        {
          status: 400,
        },
      );
    }

    const reservedSeats =
      show.ticketOrders.reduce(
        (
          total: number,
          order: {
            quantity: number;
          },
        ) =>
          total +
          order.quantity,
        0,
      );

    const heldWaitlistSeats =
      show.waitlistEntries.reduce(
        (
          total: number,
          entry: {
            quantity: number;
          },
        ) =>
          total +
          entry.quantity,
        0,
      );

    const remainingSeats =
      Math.max(
        0,
        show.capacity -
          reservedSeats -
          heldWaitlistSeats,
      );

    if (
      quantity >
      remainingSeats
    ) {
      return Response.json(
        {
          error:
            remainingSeats === 0
              ? "This show is sold out."
              : `Only ${remainingSeats} tickets remain.`,
        },
        {
          status: 400,
        },
      );
    }

    const ticketPrice =
      Number(
        show.boxOffice.ticketPrice,
      );

    const videoPrice =
      digitalVideo
        ? Number(
            show.boxOffice
              .digitalVideoPrice,
          )
        : 0;

    const ticketTotal =
      quantity *
      ticketPrice;

    const totalAmount =
      ticketTotal +
      videoPrice;

    if (
      !Number.isFinite(
        ticketPrice,
      ) ||
      ticketPrice <= 0 ||
      !Number.isFinite(
        videoPrice,
      ) ||
      videoPrice < 0 ||
      !Number.isFinite(
        totalAmount,
      ) ||
      totalAmount <= 0
    ) {
      return Response.json(
        {
          error:
            "The price for this order is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const paypalOrder =
      await createPayPalOrder({
        amount: totalAmount,

        description:
          show.performance.name,
      });

    return Response.json({
      id: paypalOrder.id,

      showId: show.id,
      quantity,
      digitalVideo,

      performanceName:
        show.performance.name,

      showName: show.name,

      ticketPrice,
      videoPrice,
      totalAmount,
    });
  } catch (error) {
    console.error(
      "Generations PayPal create error:",
      error,
    );

    return Response.json(
      {
        error:
          "We couldn't start the PayPal checkout. Please try again.",
      },
      {
        status: 500,
      },
    );
  }
}