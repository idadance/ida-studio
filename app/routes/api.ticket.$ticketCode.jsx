import { useLoaderData } from "react-router";
import prisma from "../db.server";
import { generateQRCode } from "../services/qr.server";

export async function loader({ params }) {
  const ticket = await prisma.ticketOrder.findUnique({
    where: {
      ticketCode: params.ticketCode,
    },
  });

  if (!ticket) {
    throw new Response("Ticket not found", {
      status: 404,
    });
  }

  const qr = await generateQRCode(ticket.ticketCode);

  return {
    ticketCode: ticket.ticketCode,
    qr,
  };
}

export default function TicketQR() {
  const { ticketCode, qr } = useLoaderData();

  return (
    <main style={{ padding: 40 }}>
      <h1>Ticket QR</h1>

      <p>{ticketCode}</p>

      <img
        src={qr}
        alt="QR Code"
        width={300}
        height={300}
      />
    </main>
  );
}