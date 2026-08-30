import prisma from "../db.server";

/**
 * Convert the stored Shopify ID into the
 * GraphQL ID Shopify expects.
 *
 * CHECK reservations already store a
 * DraftOrder GID.
 *
 * Older CREDIT_CARD reservations store
 * Shopify's numeric Order ID.
 */
function getShopifyGraphqlId(
  shopifyId,
  paymentMethod,
) {
  if (!shopifyId) {
    return null;
  }

  if (
    shopifyId.startsWith(
      "gid://shopify/",
    )
  ) {
    return shopifyId;
  }

  if (
    paymentMethod ===
    "CREDIT_CARD"
  ) {
    return `gid://shopify/Order/${shopifyId}`;
  }

  return shopifyId;
}

/**
 * Look up a Shopify GraphQL ID in the
 * currently authenticated Shopify store.
 */
async function lookupShopifyRecord(
  admin,
  shopifyId,
) {
  if (!shopifyId) {
    return {
      found: false,
      type: null,
    };
  }

  try {
    const response =
      await admin.graphql(
        `#graphql
          query BackfillNode($id: ID!) {
            node(id: $id) {
              id
              __typename
            }
          }
        `,
        {
          variables: {
            id: shopifyId,
          },
        },
      );

    const json =
      await response.json();

    if (json.errors) {
      console.log(
        `⚠️ Shopify lookup error for ${shopifyId}`,
        JSON.stringify(
          json.errors,
          null,
          2,
        ),
      );

      return {
        found: false,
        type: null,
      };
    }

    const node =
      json.data?.node;

    if (!node) {
      return {
        found: false,
        type: null,
      };
    }

    return {
      found: true,
      type: node.__typename,
    };
  } catch (error) {
    console.log(
      `⚠️ Could not look up ${shopifyId}`,
      error,
    );

    return {
      found: false,
      type: null,
    };
  }
}

/**
 * PREVIEW ONLY
 *
 * Finds reservations without an account
 * and checks whether they belong to the
 * currently authenticated Shopify store.
 *
 * NOTHING is written to the database.
 */
export async function previewStudioBackfill({
  admin,
}) {
  const reservations =
    await prisma.reservation.findMany({
      where: {
        account: null,
      },

      orderBy: {
        createdAt: "asc",
      },

      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        paymentMethod: true,
        status: true,
        shopifyOrderId: true,
        shopifyOrderNumber: true,
        createdAt: true,

        performance: {
          select: {
            name: true,
          },
        },
      },
    });

  const found = [];
  const notFound = [];
  const noShopifyId = [];

  for (const reservation of reservations) {
    const item = {
      id: reservation.id,

      customerName:
        reservation.customerName,

      customerEmail:
        reservation.customerEmail,

      paymentMethod:
        reservation.paymentMethod,

      status:
        reservation.status,

      performance:
        reservation.performance.name,

      shopifyOrderId:
        reservation.shopifyOrderId,

      shopifyOrderNumber:
        reservation.shopifyOrderNumber,

      createdAt:
        reservation.createdAt,
    };

    if (
      !reservation.shopifyOrderId
    ) {
      noShopifyId.push(item);
      continue;
    }

    const graphqlId =
      getShopifyGraphqlId(
        reservation.shopifyOrderId,
        reservation.paymentMethod,
      );

    const lookup =
      await lookupShopifyRecord(
        admin,
        graphqlId,
      );

    const resultItem = {
      ...item,

      shopifyGraphqlId:
        graphqlId,

      shopifyType:
        lookup.type,
    };

    if (lookup.found) {
      found.push(resultItem);
    } else {
      notFound.push(resultItem);
    }
  }

  const foundChecks =
    found.filter(
      (reservation) =>
        reservation.paymentMethod ===
        "CHECK",
    );

  const foundCreditCards =
    found.filter(
      (reservation) =>
        reservation.paymentMethod ===
        "CREDIT_CARD",
    );

  const notFoundChecks =
    notFound.filter(
      (reservation) =>
        reservation.paymentMethod ===
        "CHECK",
    );

  const notFoundCreditCards =
    notFound.filter(
      (reservation) =>
        reservation.paymentMethod ===
        "CREDIT_CARD",
    );

  return {
    totalUnassigned:
      reservations.length,

    foundInCurrentStore:
      found.length,

    notFoundInCurrentStore:
      notFound.length,

    noShopifyId:
      noShopifyId.length,

    foundChecks:
      foundChecks.length,

    foundCreditCards:
      foundCreditCards.length,

    notFoundChecks:
      notFoundChecks.length,

    notFoundCreditCards:
      notFoundCreditCards.length,

    found,
    notFound,

    missingShopifyId:
      noShopifyId,
  };
}

/**
 * ASSIGN STUDIO
 *
 * Re-checks every currently unassigned
 * reservation against the authenticated
 * Shopify store.
 *
 * Only reservations positively found in
 * that store are assigned.
 */
export async function assignStudioBackfill({
  admin,
  account,
}) {
  if (
    account !== "FW" &&
    account !== "PM"
  ) {
    throw new Error(
      "Invalid studio account.",
    );
  }

  const reservations =
    await prisma.reservation.findMany({
      where: {
        account: null,
      },

      orderBy: {
        createdAt: "asc",
      },

      select: {
        id: true,
        customerName: true,
        paymentMethod: true,
        shopifyOrderId: true,
      },
    });

  const matchedIds = [];

  for (const reservation of reservations) {
    if (
      !reservation.shopifyOrderId
    ) {
      continue;
    }

    const graphqlId =
      getShopifyGraphqlId(
        reservation.shopifyOrderId,
        reservation.paymentMethod,
      );

    const lookup =
      await lookupShopifyRecord(
        admin,
        graphqlId,
      );

    if (lookup.found) {
      matchedIds.push(
        reservation.id,
      );
    }
  }

  if (matchedIds.length === 0) {
    return {
      success: true,
      assigned: 0,
      account,
    };
  }

  const result =
    await prisma.reservation.updateMany({
      where: {
        id: {
          in: matchedIds,
        },

        // Safety check:
        // never overwrite an account that
        // may have been assigned meanwhile.
        account: null,
      },

      data: {
        account,
      },
    });

  console.log(
    `✅ Studio backfill assigned ${result.count} reservation(s) to ${account}`,
  );

  return {
    success: true,
    assigned: result.count,
    account,
  };
}

/**
 * ARCHIVE VERIFIED TEST RESERVATIONS
 *
 * Archives only the exact reservation IDs
 * supplied by the Studio Backfill preview.
 *
 * Safety:
 * - Reservation must still be unassigned.
 * - Reservation must be CHECK.
 * - Associated TicketOrders are canceled too.
 * - Nothing is deleted.
 */
export async function archiveTestReservations({
  reservationIds,
}) {
  if (
    !Array.isArray(reservationIds) ||
    reservationIds.length === 0
  ) {
    throw new Error(
      "No test reservations were selected.",
    );
  }

  const reservations =
  await prisma.reservation.findMany({
    where: {
      id: {
        in: reservationIds,
      },

      account: null,

      paymentMethod: "CHECK",

      status: {
        not: "CANCELLED",
      },
    },

      select: {
        id: true,
      },
    });

  const verifiedIds =
    reservations.map(
      (reservation) =>
        reservation.id,
    );

  if (
    verifiedIds.length !==
    reservationIds.length
  ) {
    throw new Error(
      "One or more reservations no longer match the safe test-reservation criteria. Nothing was archived.",
    );
  }

  await prisma.$transaction([
    prisma.ticketOrder.updateMany({
      where: {
        reservationId: {
          in: verifiedIds,
        },

        status: {
          not: "CANCELED",
        },
      },

      data: {
        status: "CANCELED",
      },
    }),

    prisma.reservation.updateMany({
      where: {
  id: {
    in: verifiedIds,
  },

  account: null,

  paymentMethod: "CHECK",

  status: {
    not: "CANCELLED",
  },
},

      data: {
        status: "CANCELLED",
      },
    }),
  ]);

  console.log(
    `🧹 Archived ${verifiedIds.length} verified test reservation(s)`,
  );

  return {
    success: true,
    archived:
      verifiedIds.length,
  };
}