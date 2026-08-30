import { renderToBuffer } from "@react-pdf/renderer";
import Ticket from "../pdf/Ticket";

export async function generateTicketPDF({
  ticket,
  qrCode,
}: {
  ticket: any;
  qrCode: string;
}) {
  return renderToBuffer(
    <Ticket
      ticket={ticket}
      qrCode={qrCode}
    />,
  );
}