import prisma from "../db.server";
import { generateTicketAssets } from "./ticketGenerator.server";

interface CreateTicketOrderArgs {
  show: any;
  quantity: number;

  paymentMethod: "CHECK" | "CREDIT_CARD";

  digitalVideo: boolean;

  customerName: string;
  customerEmail: string;

  ticketPrice: number;
  videoPrice: number;

  performanceId: string;

  shopifyOrderId?: string;
  shopifyOrderNumber?: string;

  reservationId?: string;

  status?: "PENDING" | "CONFIRMED";

generateAssets?: boolean;
}

export async function createReservation({
  order,
  paymentMethod,
  shopifyOrderId,
  shopifyOrderNumber,
  status = "PENDING",
}: {
  order: any;
  paymentMethod: "CHECK" | "CREDIT_CARD";
  shopifyOrderId?: string;
  shopifyOrderNumber?: string;
  status?: "PENDING" | "CONFIRMED";
}) {
  return prisma.reservation.create({
    data: {
      customerName: `${order.firstName} ${order.lastName}`,
      customerEmail: order.email,

      account: order.account,

      paymentMethod,
      status,

      digitalVideo: order.video,

      totalAmount:
        order.shows.reduce(
          (sum: number, show: any) =>
            sum + show.quantity * show.ticketPrice,
          0,
        ) + (order.video ? order.videoPrice : 0),

      performanceId: order.performanceId,

      shopifyOrderId,
      shopifyOrderNumber,
    },
  });
}

export async function createTicketOrder({
  show,
  quantity,

  paymentMethod,

  digitalVideo,

  customerName,
  customerEmail,

  ticketPrice,
  videoPrice,

  performanceId,

  shopifyOrderId,
  shopifyOrderNumber,

  reservationId,

  status = "PENDING",

  generateAssets = true,
}: CreateTicketOrderArgs) {
  const ticketSubtotal =
    quantity * ticketPrice;

  const videoSubtotal =
    digitalVideo
      ? videoPrice
      : 0;

  const totalAmount =
    ticketSubtotal +
    videoSubtotal;

  const ticket =
    await prisma.ticketOrder.create({
      data: {
        ticketCode:
          crypto.randomUUID(),

        customerName,
        customerEmail,

        quantity,

        digitalVideo,

        paymentMethod,
        status,

        ticketSubtotal,
        videoSubtotal,
        totalAmount,

        shopifyOrderId,
        shopifyOrderNumber,

        reservationId,

        showId:
          show.showId ??
          show.id,

        performanceId,
      },
    });

  if (
    status === "CONFIRMED" &&
    generateAssets
  ) {
    await generateTicketAssets(
      ticket.id,
    );
  }

  return ticket;
}

interface CreateTicketOrdersArgs {
  order: any;

  paymentMethod:
    | "CHECK"
    | "CREDIT_CARD";

  shopifyOrderId?: string;
  shopifyOrderNumber?: string;

  reservationId?: string;

  status?:
    | "PENDING"
    | "CONFIRMED";
}

export async function createTicketOrders({
  order,

  paymentMethod,

  shopifyOrderId,
  shopifyOrderNumber,

  reservationId,

  status = "PENDING",
}: CreateTicketOrdersArgs) {
  for (const show of order.shows) {
  for (let i = 0; i < show.quantity; i++) {
    await createTicketOrder({
      show,

      performanceId: order.performanceId,

      quantity: 1,

      paymentMethod,

      digitalVideo: order.video,

      customerName:
        `${order.firstName} ${order.lastName}`,

      customerEmail: order.email,

      ticketPrice: show.ticketPrice,

      videoPrice: order.videoPrice,

      shopifyOrderId,
      shopifyOrderNumber,

      reservationId,

      status,
    });
  }
}
}