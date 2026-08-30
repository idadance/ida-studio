import QRCode from "qrcode";

const BASE_URL =
  process.env.APP_URL ??
  "https://ida-tickets-app-tb5bj.ondigitalocean.app";

// ======================================
// CHECK-IN QR
//
// Used on the LIVE digital ticket.
// The self-check-in iPad scans this QR.
// ======================================

export async function generateQRCode(
  ticketCode: string,
) {
  const url =
    `${BASE_URL}/checkin/${ticketCode}`;

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
  });
}

// ======================================
// LIVE TICKET QR
//
// Used on the PDF ticket.
// A parent's PHONE scans this QR and
// opens the live digital ticket.
// ======================================

export async function generateLiveTicketQRCode(
  ticketCode: string,
) {
  const url =
    `${BASE_URL}/ticket/${ticketCode}`;

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
  });
}