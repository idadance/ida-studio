import { authenticate } from "../shopify.server";

import {
  getRegistrations,
} from "../services/registration.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const registrations =
    await getRegistrations();

  const escapeCsv = (value) => {
    const text =
      value === null || value === undefined
        ? ""
        : String(value);

    return `"${text.replace(/"/g, '""')}"`;
  };

  const headers = [
    "Dancer First Name",
    "Dancer Last Name",
    "Grade",
    "Studio",
    "Entry Type",
    "Partner First Name",
    "Partner Last Name",
    "Coordinating Dancer",
    "Teacher",
    "Genre",
    "Parent Email",
    "Payment Responsibility",
    "Payment Method",
    "Payment Status",
    "Amount",
    "Shopify Order Number",
    "Registration Status",
    "Availability",
    "Registration Date",
  ];

  const rows = registrations.map(
    (registration) => [
      registration.studentFirstName,
      registration.studentLastName,
      registration.grade,
      registration.studioCode,
      registration.entryType,
      registration.partnerFirstName,
      registration.partnerLastName,
      registration.coordinatingDancerName,
      registration.teacher
        ? `${registration.teacher.firstName}${
            registration.teacher.lastName
              ? ` ${registration.teacher.lastName}`
              : ""
          }`
        : "No Preference",
      registration.genre?.name,
      registration.customerEmail,
      registration.paymentResponsibility,
      registration.paymentMethod,
      registration.paymentStatus,
      registration.totalAmount,
      registration.shopifyOrderNumber,
      registration.status,
      registration.availability
        ?.map(
          (item) =>
            `${item.day} ${item.date} ${item.timeSlot} (${item.preferredLocation})`,
        )
        .join("; "),
      registration.createdAt
        ? new Date(
            registration.createdAt,
          ).toLocaleString()
        : "",
    ],
  );

  const csv = [headers, ...rows]
    .map((row) =>
      row.map(escapeCsv).join(","),
    )
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type":
        "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="solo-duet-registrations.csv"',
    },
  });
};