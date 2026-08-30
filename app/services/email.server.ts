import sgMail from "@sendgrid/mail";

function setupSendGrid() {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SENDGRID_API_KEY is not configured.",
    );
  }

  sgMail.setApiKey(apiKey);
}

export async function sendCheckReservationConfirmation({
  order,
  driveFolderLink,
}: {
  order: any;
  driveFolderLink: string;
}) {
  setupSendGrid();

  const isFW = order.account === "FW";

  const fromEmail = isFW
    ? "fwstudio@idadancer.com"
    : "pmstudio@idadancer.com";

  const studioName = isFW
    ? "IDA Fort Washington"
    : "IDA Plymouth Meeting";

  const ticketLines = order.shows
    .map(
      (show: any) =>
        `${show.name}: ${show.quantity} ticket${
          show.quantity === 1 ? "" : "s"
        }`,
    )
    .join("\n");

  const ticketLinesHtml = order.shows
    .map(
      (show: any) =>
        `<li><strong>${show.name}</strong>: ${show.quantity} ticket${
          show.quantity === 1 ? "" : "s"
        }</li>`,
    )
    .join("");

  const totalAmount =
    order.shows.reduce(
      (sum: number, show: any) =>
        sum + show.quantity * show.ticketPrice,
      0,
    ) + (order.video ? order.videoPrice : 0);

  await sgMail.send({
    to: order.email,

    from: {
      email: fromEmail,
      name: studioName,
    },

    replyTo: fromEmail,

    subject: `IDA Tickets – ${order.performanceName} Reservation Confirmation`,

    text: `Hi ${order.firstName},

We received your ticket reservation for ${order.performanceName}.

Payment Method: Check
Amount Due: $${totalAmount.toFixed(2)}

Tickets Reserved:
${ticketLines}

Digital Video: ${order.video ? "Yes" : "No"}

Your seats are reserved and your payment is currently pending.

Your personal IDA Tickets folder:
${driveFolderLink}

Please save this link. Once your check payment has been received, your tickets will be placed in this folder.

Thank you!
${studioName}`,

    html: `
      <p>Hi ${order.firstName},</p>

      <p>
        We received your ticket reservation for
        <strong>${order.performanceName}</strong>.
      </p>

      <p>
        <strong>Payment Method:</strong> Check<br>
        <strong>Amount Due:</strong> $${totalAmount.toFixed(2)}
      </p>

      <p><strong>Tickets Reserved:</strong></p>

      <ul>
        ${ticketLinesHtml}
      </ul>

      <p>
        <strong>Digital Video:</strong>
        ${order.video ? "Yes" : "No"}
      </p>

      <p>
        Your seats are reserved and your payment is currently pending.
      </p>

      <p>
        <a href="${driveFolderLink}">
          Open Your IDA Tickets Folder
        </a>
      </p>

      <p>
        Please save this link. Once your check payment has been received,
        your tickets will be placed in this folder.
      </p>

      <p>
        Thank you!<br>
        ${studioName}
      </p>
    `,
  });

  console.log(
    `📧 Check reservation confirmation sent to ${order.email}`,
  );
}

export async function sendPaidTicketConfirmation({
  order,
  driveFolderLink,
  reservationId,
  extraTicketRequestsEnabled,
}: {
  order: any;
  driveFolderLink: string;
  reservationId: string;
  extraTicketRequestsEnabled: boolean;
}) {
  setupSendGrid();
  const isFW = order.account === "FW";

  const fromEmail = isFW
    ? "fwstudio@idadancer.com"
    : "pmstudio@idadancer.com";

  const studioName = isFW
    ? "IDA Fort Washington"
    : "IDA Plymouth Meeting";

    const additionalTicketsUrl =
  `https://tickets.instituteofdanceartistry.com/additional-tickets?reservationId=${encodeURIComponent(
    reservationId,
  )}`;
  const additionalTicketsText =
  extraTicketRequestsEnabled
    ? `

Need additional tickets?

You may submit a request for additional tickets here:
${additionalTicketsUrl}

Additional tickets are not guaranteed. Requests will be handled in the order they were received.`
    : "";

const additionalTicketsHtml =
  extraTicketRequestsEnabled
    ? `
      <div
        style="
          margin-top: 24px;
          padding: 20px;
          background: #fdf2f8;
          border-radius: 12px;
        "
      >
        <p style="margin-top: 0;">
          <strong>Need additional tickets?</strong>
        </p>

        <p>
          You may submit a request for additional
          tickets. Additional tickets are not
          guaranteed and requests will be handled
          in the order they were received.
        </p>

        <p style="margin-bottom: 0;">
          <a
            href="${additionalTicketsUrl}"
            style="
              display: inline-block;
              background: #E25186;
              color: #ffffff;
              text-decoration: none;
              padding: 12px 20px;
              border-radius: 999px;
              font-weight: 600;
            "
          >
            Request Additional Tickets
          </a>
        </p>
      </div>
    `
    : "";

  const ticketLines = order.shows
    .map(
      (show: any) =>
        `${show.name}: ${show.quantity} ticket${
          show.quantity === 1 ? "" : "s"
        }`,
    )
    .join("\n");

  const ticketLinesHtml = order.shows
    .map(
      (show: any) =>
        `<li><strong>${show.name}</strong>: ${show.quantity} ticket${
          show.quantity === 1 ? "" : "s"
        }</li>`,
    )
    .join("");

  await sgMail.send({
    to: order.email,

    from: {
      email: fromEmail,
      name: studioName,
    },

    replyTo: fromEmail,

    subject:
      `IDA Tickets – ${order.performanceName} Tickets`,

    text: `Hi ${order.firstName},

Thank you for your ticket purchase for ${order.performanceName}.

Tickets:
${ticketLines}

Digital Video: ${order.video ? "Yes" : "No"}

Your tickets are ready in your personal IDA Tickets folder:

${driveFolderLink}

Please save this link. You can use it anytime to access your tickets.
${additionalTicketsText}

Thank you!
${studioName}`,

    html: `
      <p>Hi ${order.firstName},</p>

      <p>
        Thank you for your ticket purchase for
        <strong>${order.performanceName}</strong>.
      </p>

      <p><strong>Your Tickets:</strong></p>

      <ul>
        ${ticketLinesHtml}
      </ul>

      <p>
        <strong>Digital Video:</strong>
        ${order.video ? "Yes" : "No"}
      </p>

      <p>
        Your tickets are ready in your personal
        IDA Tickets folder.
      </p>

      <p>
        <a href="${driveFolderLink}">
          Open Your IDA Tickets Folder
        </a>
      </p>

      <p>
  Please save this link. You can use it anytime
  to access your tickets.
</p>

${additionalTicketsHtml}

<p>
  Thank you!<br>
  ${studioName}
</p>
    `,
  });

  console.log(
    `📧 Paid ticket confirmation sent to ${order.email}`,
  );
}