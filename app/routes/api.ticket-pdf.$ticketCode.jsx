import { renderToStream } from "@react-pdf/renderer";
import prisma from "../db.server";
import Ticket from "../pdf/Ticket";
import { generateQRCode } from "../services/qr.server";

export async function loader({ params }) {
    const ticket = await prisma.ticketOrder.findUnique({
  where: {
    ticketCode: params.ticketCode,
  },
  include: {
    show: true,
    performance: true,
    reservation: true,
  },
});

if (!ticket) {
  throw new Response("Ticket not found", {
    status: 404,
  });
}

const qrCode = await generateQRCode(
  ticket.ticketCode,
);
  const stream = await renderToStream(
  <Ticket
    ticket={ticket}
    qrCode={qrCode}
  />
);

  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
    },
  });
}