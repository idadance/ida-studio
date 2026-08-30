import {
  useLoaderData,
} from "react-router";

import prisma from "../db.server";

import {
  authenticate,
} from "../shopify.server";

// ======================================
// STORES
// ======================================

const STORES = [
  {
    account: "FW",
    shop:
      "ida-dance-store.myshopify.com",
    label: "Fort Washington",
  },
  {
    account: "PM",
    shop:
      "ida-dance-store-pm.myshopify.com",
    label: "Plymouth Meeting",
  },
];

// ======================================
// GET CONFIGURED VIDEO VARIANTS
//
// These are the Shopify variants that
// represent Digital Video purchases.
// ======================================

async function getProductVariantMaps() {
    const performances =
    await prisma.performance.findMany({
      select: {
        id: true,
        name: true,

        fwCheckVideoVariantId: true,
        fwCreditVideoVariantId: true,

        pmCheckVideoVariantId: true,
        pmCreditVideoVariantId: true,
      },
    });

  const videoMap =
  new Map();

const ticketMap =
  new Map();

  for (const performance of performances) {
    const variants = [
      {
        account: "FW",
        paymentType: "CHECK",
        variantId:
          performance.fwCheckVideoVariantId,
      },
      {
        account: "FW",
        paymentType:
          "CREDIT_CARD",
        variantId:
          performance.fwCreditVideoVariantId,
      },
      {
        account: "PM",
        paymentType: "CHECK",
        variantId:
          performance.pmCheckVideoVariantId,
      },
      {
        account: "PM",
        paymentType:
          "CREDIT_CARD",
        variantId:
          performance.pmCreditVideoVariantId,
      },
    ];

    for (const variant of variants) {
      if (!variant.variantId) {
        continue;
      }

      videoMap.set(
        `${variant.account}:${variant.variantId}`,
        {
          performanceId:
            performance.id,

          performanceName:
            performance.name,

          account:
            variant.account,

          paymentType:
            variant.paymentType,

          variantId:
            variant.variantId,
        },
      );
    }
  }

  // Ticket variants belong to the shows
// rather than directly to Performance.
const shows =
  await prisma.show.findMany({
    select: {
      id: true,
      performanceId: true,

      fwCheckTicketVariantId: true,
      fwCreditTicketVariantId: true,

      pmCheckTicketVariantId: true,
      pmCreditTicketVariantId: true,
    },
  });

for (const show of shows) {
  const variants = [
    {
      account: "FW",
      variantId:
        show.fwCheckTicketVariantId,
    },
    {
      account: "FW",
      variantId:
        show.fwCreditTicketVariantId,
    },
    {
      account: "PM",
      variantId:
        show.pmCheckTicketVariantId,
    },
    {
      account: "PM",
      variantId:
        show.pmCreditTicketVariantId,
    },
  ];

  for (const variant of variants) {
    if (!variant.variantId) {
      continue;
    }

    ticketMap.set(
      `${variant.account}:${variant.variantId}`,
      {
        showId: show.id,
        performanceId:
          show.performanceId,
      },
    );
  }
}

return {
  videoMap,
  ticketMap,
};
}

// ======================================
// SHOPIFY HISTORICAL VIDEO AUDIT
//
// READ ONLY.
//
// Reads Shopify orders from BOTH stores,
// identifies line items using one of our
// configured Digital Video variants,
// then checks whether IDA Tickets has a
// corresponding reservation.
//
// This catches the historical bug where
// a paid VIDEO-ONLY credit-card order
// could be skipped by the webhook.
// ======================================

async function getShopifyVideoAudit(
  admin,
  account,
  studioLabel,
) {
  const {
  videoMap,
  ticketMap,
} =
  await getProductVariantMaps();

  const shopifyVideoOrders = [];

const store = {
  account,
  label: studioLabel,
};

let hasNextPage = true;
let cursor = null;

    while (hasNextPage) {
      const response =
        await admin.graphql(
          `#graphql
            query VideoOrderAudit(
              $first: Int!
              $after: String
            ) {
              orders(
                first: $first
                after: $after
                sortKey: CREATED_AT
                reverse: true
                query: "financial_status:paid"
              ) {
                edges {
                  cursor

                  node {
                    id
                    name
                    createdAt
                    displayFinancialStatus

                    lineItems(
                      first: 100
                    ) {
                      nodes {
                        title
                        quantity

                        variant {
                          id
                          legacyResourceId
                        }
                      }
                    }
                  }
                }

                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          `,
          {
            variables: {
              first: 100,
              after: cursor,
            },
          },
        );

      const json =
        await response.json();

      if (json.errors) {
        throw new Error(
          `Shopify order audit failed for ${store.label}: ${JSON.stringify(
            json.errors,
          )}`,
        );
      }

      const orders =
        json.data?.orders;

      if (!orders) {
        throw new Error(
          `Shopify returned no order data for ${store.label}.`,
        );
      }

      for (const edge of orders.edges) {
        const order =
          edge.node;

        const matchedVideos = [];
        let containsTicket = false;

        for (
          const lineItem of
          order.lineItems.nodes
        ) {
          const legacyVariantId =
            lineItem.variant
              ?.legacyResourceId
              ?.toString();

          if (!legacyVariantId) {
            continue;
          }
          const ticketMatch =
  ticketMap.get(
    `${store.account}:${legacyVariantId}`,
  );

if (ticketMatch) {
  containsTicket = true;
}

          const videoMatch =
  videoMap.get(
    `${store.account}:${legacyVariantId}`,
  );

          if (!videoMatch) {
            continue;
          }

          matchedVideos.push({
            ...videoMatch,

            lineItemTitle:
              lineItem.title,

            quantity:
              lineItem.quantity,
          });
        }

        if (
          matchedVideos.length === 0
        ) {
          continue;
        }

        // We are specifically auditing the
// historical VIDEO-ONLY bug.
//
// Orders that also contain tickets went
// through the normal ticket workflow and
// are not the scenario we're looking for.
if (containsTicket) {
  continue;
}

        // One Shopify order should only
        // correspond to one performance,
        // but keep each matched performance
        // explicit for audit safety.
        const uniquePerformances =
          new Map();

        for (
          const match of
          matchedVideos
        ) {
          uniquePerformances.set(
            match.performanceId,
            match,
          );
        }

        for (
          const match of
          uniquePerformances.values()
        ) {
          const numericOrderId =
            order.id
              .split("/")
              .pop();

          const reservation =
            await prisma.reservation.findFirst({
              where: {
                OR: [
                  {
                    shopifyOrderId:
                      numericOrderId,
                  },
                  {
                    shopifyOrderId:
                      order.id,
                  },
                  {
                    shopifyOrderNumber:
                      order.name,
                  },
                ],

                performanceId:
                  match.performanceId,
              },

              select: {
                id: true,
                status: true,
                digitalVideo: true,
                driveFolderId: true,
                driveFolderLink: true,
              },
            });

          const customerName =
  "Shopify Customer";

          shopifyVideoOrders.push({
            shopifyOrderId:
              numericOrderId,

            shopifyOrderGid:
              order.id,

            shopifyOrderNumber:
              order.name,

            createdAt:
              order.createdAt,

            customerName,

            customerEmail: "",

            account:
              store.account,

            studioLabel:
              store.label,

            performanceId:
              match.performanceId,

            performanceName:
              match.performanceName,

            paymentType:
              match.paymentType,

            lineItemTitle:
              match.lineItemTitle,

            reservationFound:
              Boolean(reservation),

            reservationId:
              reservation?.id || null,

            reservationStatus:
              reservation?.status ||
              null,

            reservationDigitalVideo:
              reservation?.digitalVideo ??
              null,

            driveFolderId:
              reservation?.driveFolderId ||
              null,

            driveFolderLink:
              reservation?.driveFolderLink ||
              null,
          });
        }
      }

      hasNextPage =
        orders.pageInfo.hasNextPage;

      cursor =
        orders.pageInfo.endCursor;
      }

  shopifyVideoOrders.sort(
    (a, b) =>
      new Date(
        b.createdAt,
      ).getTime() -
      new Date(
        a.createdAt,
      ).getTime(),
  );

  const missingFromIDA =
    shopifyVideoOrders.filter(
      (order) =>
        !order.reservationFound,
    );

  const recordedInIDA =
    shopifyVideoOrders.filter(
      (order) =>
        order.reservationFound,
    );

  return {
    shopifyVideoOrderCount:
      shopifyVideoOrders.length,

    recordedInIDACount:
      recordedInIDA.length,

    missingFromIDACount:
      missingFromIDA.length,

    missingFromIDA,

    recordedInIDA,
  };
}

// ======================================
// LOADER
// ======================================

export const loader = async ({ request }) => {
  try {
    const { admin, session } =
  await authenticate.admin(request);

const account =
  session.shop ===
  "ida-dance-store.myshopify.com"
    ? "FW"
    : "PM";

const studioLabel =
  account === "FW"
    ? "Fort Washington"
    : "Plymouth Meeting";
    console.log(
      "🔍 Starting historical Digital Video audit...",
    );

    const shopifyAudit =
  await getShopifyVideoAudit(
    admin,
    account,
    studioLabel,
  );

    console.log(
      "✅ Historical Digital Video audit finished",
      {
        found:
          shopifyAudit.shopifyVideoOrderCount,
        recorded:
          shopifyAudit.recordedInIDACount,
        missing:
          shopifyAudit.missingFromIDACount,
      },
    );

    return Response.json({
      shopifyAudit,
    });
  } catch (error) {
    console.error(
      "❌ HISTORICAL VIDEO AUDIT FAILED",
    );

    console.error(error);

    if (error instanceof Error) {
      console.error(
        "MESSAGE:",
        error.message,
      );

      console.error(
        "STACK:",
        error.stack,
      );
    }

    throw error;
  }
};

// ======================================
// PAGE
// ======================================

export default function TicketsRoute() {
  const data =
    useLoaderData();

  const shopify =
    data.shopifyAudit;

  return (
    <main
      style={{
        padding: "30px",
        fontFamily: "system-ui",
        maxWidth: "900px",
      }}
    >
      <h1>
        Historical Digital Video Audit
      </h1>

      <p
        style={{
          fontSize: "17px",
          lineHeight: 1.5,
        }}
      >
        Read-only audit of paid Digital
        Video purchases from both Shopify
        stores. This checks whether each
        Shopify video purchase has a
        corresponding reservation in IDA
        Tickets.
      </p>

      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          background: "#f5f5f5",
          borderRadius: "10px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Audit Summary
        </h2>

        <p>
          Shopify Digital Video orders
          found:{" "}
          <strong>
            {
              shopify.shopifyVideoOrderCount
            }
          </strong>
        </p>

        <p>
          Recorded in IDA Tickets:{" "}
          <strong>
            {
              shopify.recordedInIDACount
            }
          </strong>
        </p>

        <p
          style={{
            fontSize: "20px",
            fontWeight: "800",
            color:
              shopify.missingFromIDACount >
              0
                ? "#b91c1c"
                : "#15803d",
          }}
        >
          {shopify.missingFromIDACount >
          0
            ? `⚠️ ${shopify.missingFromIDACount} Shopify video order(s) are missing from IDA Tickets`
            : "✅ Every Shopify video order is recorded in IDA Tickets"}
        </p>
      </div>

      {shopify.missingFromIDACount >
        0 && (
        <section
          style={{
            marginTop: "30px",
          }}
        >
          <h2>
            ⚠️ Missing From IDA Tickets
          </h2>

          <p>
            These are paid Shopify
            Digital Video purchases for
            which no corresponding IDA
            reservation was found.
          </p>

          <div
            style={{
              display: "grid",
              gap: "16px",
              marginTop: "20px",
            }}
          >
            {shopify.missingFromIDA.map(
              (order) => (
                <div
                  key={`${order.account}-${order.shopifyOrderNumber}-${order.performanceId}`}
                  style={{
                    padding: "20px",
                    border:
                      "2px solid #b91c1c",
                    borderRadius:
                      "10px",
                    background:
                      "#fef2f2",
                  }}
                >
                  <h3
                    style={{
                      marginTop: 0,
                    }}
                  >
                    {
                      order.shopifyOrderNumber
                    }
                  </h3>

                  <p>
                    Performance:{" "}
                    <strong>
                      {
                        order.performanceName
                      }
                    </strong>
                  </p>

                  <p>
                    Studio:{" "}
                    <strong>
                      {
                        order.studioLabel
                      }
                    </strong>
                  </p>

                  <p>
                    Payment Type:{" "}
                    <strong>
                      {
                        order.paymentType
                      }
                    </strong>
                  </p>

                  <p>
                    Product:{" "}
                    <strong>
                      {
                        order.lineItemTitle
                      }
                    </strong>
                  </p>

                  <p>
                    Purchased:{" "}
                    <strong>
                      {new Date(
                        order.createdAt,
                      ).toLocaleString()}
                    </strong>
                  </p>

                  <p
                    style={{
                      marginBottom: 0,
                      color: "#b91c1c",
                      fontWeight: "800",
                    }}
                  >
                    No matching IDA
                    reservation found.
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </main>
  );
}