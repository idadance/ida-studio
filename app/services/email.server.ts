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

export async function sendEventCheckReservationConfirmation({
  order,
  eventName,
  locationName,
  totalAmount,
  draftOrderName,
}: {
  order: any;
  eventName: string;
  locationName: string;
  totalAmount: number;
  draftOrderName: string;
}) {
  setupSendGrid();

  const isFW = order.account === "FW";

  const fromEmail = isFW
    ? "fwstudio@idadancer.com"
    : "pmstudio@idadancer.com";

  const studioName = isFW
    ? "IDA Fort Washington"
    : "IDA Plymouth Meeting";

  const quantity = Number(
    order.eventQuantity,
  );

  const spotLabel =
    quantity === 1 ? "spot" : "spots";

  await sgMail.send({
    to: order.email,

    from: {
      email: fromEmail,
      name: studioName,
    },

    replyTo: fromEmail,

    subject:
      `IDA – ${eventName} Reservation Confirmation`,

    text: `Hi ${order.firstName},

We received your reservation for ${eventName}.

Reservation Number: ${draftOrderName}
Location: ${locationName}
Reserved: ${quantity} ${spotLabel}
Payment Method: Check
Amount Due: $${totalAmount.toFixed(2)}

Your reservation has been saved and your payment is currently pending.

Please drop your check at the studio or mail your payment to:

Institute of Dance Artistry
PO Box 114
Fort Washington, PA 19034

Thank you!
${studioName}`,

    html: `
      <p>Hi ${order.firstName},</p>

      <p>
        We received your reservation for
        <strong>${eventName}</strong>.
      </p>

      <p>
        <strong>Reservation Number:</strong>
        ${draftOrderName}<br>

        <strong>Location:</strong>
        ${locationName}<br>

        <strong>Reserved:</strong>
        ${quantity} ${spotLabel}<br>

        <strong>Payment Method:</strong>
        Check<br>

        <strong>Amount Due:</strong>
        $${totalAmount.toFixed(2)}
      </p>

      <p>
        Your reservation has been saved and your
        payment is currently pending.
      </p>

      <p>
        Please drop your check at the studio or
        mail your payment to:
      </p>

      <div
        style="
          padding: 16px;
          background: #fdf2f8;
          border-radius: 12px;
        "
      >
        <strong>
          Institute of Dance Artistry
        </strong><br>
        PO Box 114<br>
        Fort Washington, PA 19034
      </div>

      <p>
        Thank you!<br>
        ${studioName}
      </p>
    `,
  });

  console.log(
    `📧 Event check reservation confirmation sent to ${order.email}`,
  );
}

export async function sendSoloDuetCheckConfirmation({
  registration,
  draftOrderName,
}: {
  registration: any;
  draftOrderName: string;
}) {
  setupSendGrid();

  const isFW =
    registration.studioCode === "FW";

  const fromEmail = isFW
    ? "fwstudio@idadancer.com"
    : "pmstudio@idadancer.com";

  const studioName = isFW
    ? "IDA Fort Washington"
    : "IDA Plymouth Meeting";

  const dancerName =
    `${registration.studentFirstName} ${registration.studentLastName}`.trim();

  const routineType =
    registration.entryType === "DUET"
      ? "Duet"
      : "Solo";

  const teacherName =
    registration.teacher
      ? `${registration.teacher.firstName}${
          registration.teacher.lastName
            ? ` ${registration.teacher.lastName}`
            : ""
        }`
      : "No Preference";

  const genreName =
    registration.genre?.name || "";

  const amountDue =
    Number(registration.totalAmount);

  await sgMail.send({
    to: registration.customerEmail,

    from: {
      email: fromEmail,
      name: studioName,
    },

    replyTo: fromEmail,

    subject:
      "IDA – Solo/Duet Registration Confirmation",

    text: `Hi ${registration.studentFirstName},

We received your Solo/Duet registration.

Registration Number: ${draftOrderName}
Dancer: ${dancerName}
Routine Type: ${routineType}
Genre: ${genreName}
Teacher: ${teacherName}
Payment Method: Check
Amount Due: $${amountDue.toFixed(2)}

Your Solo/Duet registration has been saved and your payment is currently pending.

Please drop your check at the studio or mail your payment to:

Institute of Dance Artistry
PO Box 114
Fort Washington, PA 19034

Thank you!
${studioName}`,

    html: `
      <p>
        Hi ${registration.studentFirstName},
      </p>

      <p>
        We received your
        <strong>Solo/Duet registration</strong>.
      </p>

      <p>
        <strong>Registration Number:</strong>
        ${draftOrderName}<br>

        <strong>Dancer:</strong>
        ${dancerName}<br>

        <strong>Routine Type:</strong>
        ${routineType}<br>

        <strong>Genre:</strong>
        ${genreName}<br>

        <strong>Teacher:</strong>
        ${teacherName}<br>

        <strong>Payment Method:</strong>
        Check<br>

        <strong>Amount Due:</strong>
        $${amountDue.toFixed(2)}
      </p>

      <p>
        Your Solo/Duet registration has been saved
        and your payment is currently pending.
      </p>

      <p>
        Please drop your check at the studio or
        mail your payment to:
      </p>

      <div
        style="
          padding: 16px;
          background: #fdf2f8;
          border-radius: 12px;
        "
      >
        <strong>
          Institute of Dance Artistry
        </strong><br>
        PO Box 114<br>
        Fort Washington, PA 19034
      </div>

      <p>
        Thank you!<br>
        ${studioName}
      </p>
    `,
  });

  console.log(
    `📧 Solo/Duet check confirmation sent to ${registration.customerEmail}`,
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

export async function sendSoloDuetPartnerPayingConfirmation({
  registration,
}: {
  registration: any;
}) {
  setupSendGrid();

  const isFW =
    registration.studioCode === "FW";

  const fromEmail = isFW
    ? "fwstudio@idadancer.com"
    : "pmstudio@idadancer.com";

  const studioName = isFW
    ? "IDA Fort Washington"
    : "IDA Plymouth Meeting";

  const dancerName =
    `${registration.studentFirstName} ${registration.studentLastName}`.trim();

  const partnerName =
    `${registration.partnerFirstName || ""} ${registration.partnerLastName || ""}`.trim();

  const teacherName =
    registration.teacher
      ? `${registration.teacher.firstName}${
          registration.teacher.lastName
            ? ` ${registration.teacher.lastName}`
            : ""
        }`
      : "No Preference";

  const genreName =
    registration.genre?.name || "";

  await sgMail.send({
    to: registration.customerEmail,

    from: {
      email: fromEmail,
      name: studioName,
    },

    replyTo: fromEmail,

    subject:
      "IDA – Solo/Duet Registration Confirmation",

    text: `Hi ${registration.studentFirstName},

We received your Duet registration.

Dancer: ${dancerName}
Duet Partner: ${partnerName}
Genre: ${genreName}
Teacher: ${teacherName}

Your duet partner is responsible for the full duet registration fee. No payment is due from you at this time.

Thank you!
${studioName}`,

    html: `
      <p>
        Hi ${registration.studentFirstName},
      </p>

      <p>
        We received your
        <strong>Duet registration</strong>.
      </p>

      <p>
        <strong>Dancer:</strong>
        ${dancerName}<br>

        <strong>Duet Partner:</strong>
        ${partnerName}<br>

        <strong>Genre:</strong>
        ${genreName}<br>

        <strong>Teacher:</strong>
        ${teacherName}
      </p>

      <div
        style="
          margin-top: 24px;
          padding: 16px;
          background: #fdf2f8;
          border-radius: 12px;
        "
      >
        <strong>
          Your duet partner is responsible for the full duet registration fee.
        </strong>

        <p style="margin-bottom: 0;">
          No payment is due from you at this time.
        </p>
      </div>

      <p>
        Thank you!<br>
        ${studioName}
      </p>
    `,
  });

  console.log(
    `📧 Solo/Duet partner-paying confirmation sent to ${registration.customerEmail}`,
  );
}

export async function sendGenerationsTicketConfirmation({
  order,
  driveFolderLink,
}: {
  order: any;
  driveFolderLink: string;
}) {
  setupSendGrid();

  const fromEmail =
    "admin@generationsdance.com";

  const organizationName =
    "Generations Dance Concert";

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

  const formattedTotal =
    Number(order.total).toFixed(2);

  await sgMail.send({
    to: order.email,

    from: {
      email: fromEmail,
      name: organizationName,
    },

    replyTo: fromEmail,

    subject:
      `Your ${order.performanceName} Tickets`,

    text: `Hi ${order.firstName},

Thank you for your ticket purchase for ${order.performanceName}.

Your purchase supports the Generations Dance Foundation.

Tickets:
${ticketLines}

Total Paid: $${formattedTotal}

Your tickets are ready here:

${driveFolderLink}

Please save this link. Each ticket contains a QR code that will be scanned at the door.

Thank you for supporting the Generations Dance Foundation!

Generations Dance Concert`,

    html: `
      <p>Hi ${order.firstName},</p>

      <p>
        Thank you for your ticket purchase for
        <strong>${order.performanceName}</strong>.
      </p>

      <p>
        Your purchase supports the
        <strong>Generations Dance Foundation</strong>.
      </p>

      <p><strong>Your Tickets:</strong></p>

      <ul>
        ${ticketLinesHtml}
      </ul>

      <p>
        <strong>Total Paid:</strong>
        $${formattedTotal}
      </p>

      <p>
        Your tickets are ready in your personal
        ticket folder:
      </p>

      <p>
        <a href="${driveFolderLink}">
          Open Your Tickets
        </a>
      </p>

      <p>
        Please save this link. Each ticket contains
        a QR code that will be scanned at the door.
      </p>

      <p>
        Thank you for supporting the
        Generations Dance Foundation!
      </p>

      <p>
        Generations Dance Concert
      </p>
    `,
  });

  console.log(
    `📧 Generations ticket confirmation sent to ${order.email}`,
  );
}

export async function sendSixersCheckReservationConfirmation({
  order,
  tierName,
  quantity,
  totalAmount,
  draftOrderName,
}: {
  order: any;
  tierName: string;
  quantity: number;
  totalAmount: number;
  draftOrderName: string;
}) {
  setupSendGrid();

  const isFW = order.account === "FW";
  const fromEmail = isFW
    ? "fwstudio@idadancer.com"
    : "pmstudio@idadancer.com";
  const studioName = isFW
    ? "IDA Fort Washington"
    : "IDA Plymouth Meeting";

  const details = [
    `Reservation Number: ${draftOrderName}`,
    `Event: Philadelphia 76ers Game`,
    `Ticket Type: ${tierName}`,
    `Quantity: ${quantity}`,
    `Studio: ${studioName}`,
    `Payment Method: Check`,
    `Amount Due: $${totalAmount.toFixed(2)}`,
  ];

  const message = `Hi ${order.firstName},

Thank you for reserving your Philadelphia 76ers tickets!

${details.join("\n")}

Your reservation has been received. Payment by check is pending.

Please drop off your check at the studio or mail it to:

Institute of Dance Artistry
PO Box 114
Fort Washington, PA 19034

IMPORTANT: Game tickets will be delivered separately through Ticketmaster. No game tickets or QR codes are issued by IDA at checkout.

Thank you!
${studioName}`;

  await sgMail.send({
    to: order.email,
    from: {
      email: fromEmail,
      name: studioName,
    },
    replyTo: fromEmail,
    subject: `IDA – Philadelphia 76ers Reservation ${draftOrderName}`,
    text: message,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6">
      <p>Hi ${escapeSixersEmailHtml(String(order.firstName || ""))},</p>
      <p>Thank you for reserving your <strong>Philadelphia 76ers tickets!</strong></p>
      <p>${details.map((line) => escapeSixersEmailHtml(line)).join("<br>")}</p>
      <p>Your reservation has been received. <strong>Payment by check is pending.</strong></p>
      <p>Please drop off your check at the studio or mail it to:</p>
      <p><strong>Institute of Dance Artistry</strong><br>PO Box 114<br>Fort Washington, PA 19034</p>
      <p><strong>Important:</strong> Game tickets will be delivered separately through Ticketmaster. No game tickets or QR codes are issued by IDA at checkout.</p>
      <p>Thank you!<br>${studioName}</p>
    </div>`,
  });
}

function escapeSixersEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[character];
  });
}
