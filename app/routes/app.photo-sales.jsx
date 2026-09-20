import {
  useLoaderData,
} from "react-router";

import {
  useState,
} from "react";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";

function getAccountFromShop(shop) {
  if (
    shop ===
    "ida-dance-store.myshopify.com"
  ) {
    return "FW";
  }

  if (
    shop ===
    "ida-dance-store-pm.myshopify.com"
  ) {
    return "PM";
  }

  throw new Error(
    "This Shopify store is not recognized as an IDA studio.",
  );
}

export const loader = async ({
  request,
}) => {
  const { session } =
    await authenticate.admin(request);

  const account =
    getAccountFromShop(session.shop);

  const orders =
    await prisma.photoOrder.findMany({
      include: {
        photos: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const paidOrders =
    orders.filter(
      (order) =>
        order.status === "PAID",
    );

  const photoCounts = {};

  for (const order of paidOrders) {
    for (const photo of order.photos) {
      photoCounts[photo.photoNumber] =
        (photoCounts[photo.photoNumber] || 0) +
        1;
    }
  }

  const photographerPhotos =
    Object.keys(photoCounts).sort(
      (a, b) =>
        Number(a) - Number(b),
    );

  return {
    account,
    orders,
    summary: {
      paidOrders:
        paidOrders.length,

      waitingForCheck:
        orders.filter(
          (order) =>
            order.status === "PENDING" &&
            order.paymentMethod === "CHECK",
        ).length,

      purchasedPhotos:
        paidOrders.reduce(
          (total, order) =>
            total + order.photos.length,
          0,
        ),

      uniquePhotos:
        photographerPhotos.length,
    },

    photographerPhotos,
    photoCounts,
  };
};

function SummaryCard({
  label,
  value,
  description,
}) {
  return (
    <div
      style={{
        border: "1px solid #e1e3e5",
        borderRadius: "12px",
        padding: "18px",
        background: "#ffffff",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#616161",
          marginBottom: "7px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "28px",
          lineHeight: 1.1,
          fontWeight: 700,
          marginBottom: "6px",
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#6d7175",
        }}
      >
        {description}
      </div>
    </div>
  );
}

function getStatusLabel(order) {
  if (
    order.status === "PENDING" &&
    order.paymentMethod === "CHECK"
  ) {
    return "Waiting for Check";
  }

  if (order.status === "PAID") {
    return "Paid";
  }

  if (order.status === "CANCELED") {
    return "Canceled";
  }

  if (order.status === "REFUNDED") {
    return "Refunded";
  }

  return order.status;
}

function getStatusStyle(order) {
  if (order.status === "PAID") {
    return {
      background: "#eaf7ed",
      color: "#17712f",
    };
  }

  if (
    order.status === "PENDING" &&
    order.paymentMethod === "CHECK"
  ) {
    return {
      background: "#fff4d6",
      color: "#7a4f01",
    };
  }

  return {
    background: "#f1f1f1",
    color: "#616161",
  };
}

export default function PhotoSalesPage() {
  const {
    orders,
    summary,
    photographerPhotos,
    photoCounts,
  } = useLoaderData();

  const [copied, setCopied] =
    useState(false);

  const photographerList =
    photographerPhotos.join(", ");

  async function copyList() {
    try {
      await navigator.clipboard.writeText(
        photographerList,
      );

      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        2000,
      );
    } catch (error) {
      console.error(
        "Could not copy photographer list:",
        error,
      );
    }
  }

  function downloadCsv() {
    const rows = [
      [
        "Photo Number",
        "Purchase Count",
      ],

      ...photographerPhotos.map(
        (photoNumber) => [
          photoNumber,
          photoCounts[photoNumber],
        ],
      ),
    ];

    const csv =
      rows
        .map((row) =>
          row
            .map((value) =>
              `"${String(value).replace(
                /"/g,
                '""',
              )}"`,
            )
            .join(","),
        )
        .join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8;",
        },
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      "senior-rep-photographer-list.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <s-page heading="Photo Sales">
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-end",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            Senior REP Photoshoot
          </div>

          <div
            style={{
              color: "#6d7175",
              fontSize: "14px",
            }}
          >
            Fort Washington + Plymouth Meeting
          </div>
        </div>

        <div
          style={{
            fontSize: "13px",
            color: "#6d7175",
          }}
        >
          Photographer list includes paid orders only.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <SummaryCard
          label="Paid Orders"
          value={summary.paidOrders}
          description="Completed photo orders"
        />

        <SummaryCard
          label="Waiting for Check"
          value={summary.waitingForCheck}
          description="Reserved but not yet paid"
        />

        <SummaryCard
          label="Photos Purchased"
          value={summary.purchasedPhotos}
          description="Paid photo purchases"
        />

        <SummaryCard
          label="Unique Photos"
          value={summary.uniquePhotos}
          description="Files needed from photographer"
        />
      </div>

      <s-section heading="Photographer List">
        {photographerPhotos.length === 0 ? (
          <s-text>
            No paid photo orders yet.
          </s-text>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  color: "#616161",
                }}
              >
                {summary.uniquePhotos} unique{" "}
                {summary.uniquePhotos === 1
                  ? "photo"
                  : "photos"}{" "}
                across {summary.purchasedPhotos}{" "}
                paid{" "}
                {summary.purchasedPhotos === 1
                  ? "purchase"
                  : "purchases"}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <s-button
                  onClick={copyList}
                >
                  {copied
                    ? "Copied!"
                    : "Copy List"}
                </s-button>

                <s-button
                  onClick={downloadCsv}
                >
                  Download CSV
                </s-button>
              </div>
            </div>

            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                background: "#f7f7f7",
                marginBottom: "16px",
                fontSize: "16px",
                fontWeight: 600,
                lineHeight: 1.6,
              }}
            >
              {photographerList}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "8px",
              }}
            >
              {photographerPhotos.map(
                (photoNumber) => (
                  <div
                    key={photoNumber}
                    style={{
                      border:
                        "1px solid #e1e3e5",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                      }}
                    >
                      {photoNumber}
                    </div>

                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6d7175",
                        marginTop: "2px",
                      }}
                    >
                      {photoCounts[
                        photoNumber
                      ]}{" "}
                      {photoCounts[
                        photoNumber
                      ] === 1
                        ? "purchase"
                        : "purchases"}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </s-section>

      <s-section heading="Orders">
        {orders.length === 0 ? (
          <s-text>
            No photo orders yet.
          </s-text>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "10px",
            }}
          >
            {orders.map((order) => {
              const photos =
                order.photos
                  .map(
                    (photo) =>
                      photo.photoNumber,
                  )
                  .sort(
                    (a, b) =>
                      Number(a) -
                      Number(b),
                  );

              const statusStyle =
                getStatusStyle(order);

              return (
                <div
                  key={order.id}
                  style={{
                    border:
                      "1px solid #e1e3e5",
                    borderRadius: "10px",
                    padding: "16px",
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(150px, 1.2fr) minmax(140px, 1fr) minmax(110px, .8fr) minmax(150px, 1.3fr) minmax(110px, .8fr)",
                      gap: "16px",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          marginBottom: "3px",
                        }}
                      >
                        {order.dancerName}
                      </div>

                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6d7175",
                        }}
                      >
                        {order.customerName}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6d7175",
                          marginBottom: "3px",
                        }}
                      >
                        Studio
                      </div>

                      <div>
                        {order.studioCode ===
                        "FW"
                          ? "Fort Washington"
                          : "Plymouth Meeting"}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6d7175",
                          marginBottom: "3px",
                        }}
                      >
                        Payment
                      </div>

                      <div>
                        {order.paymentMethod ===
                        "CHECK"
                          ? "Check"
                          : "Credit Card"}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6d7175",
                          marginBottom: "3px",
                        }}
                      >
                        Photos
                      </div>

                      <div
                        style={{
                          fontWeight: 600,
                        }}
                      >
                        {photos.join(", ")}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "inline-block",
                          padding:
                            "4px 9px",
                          borderRadius:
                            "999px",
                          fontSize: "12px",
                          fontWeight: 600,
                          marginBottom:
                            "6px",
                          ...statusStyle,
                        }}
                      >
                        {getStatusLabel(
                          order,
                        )}
                      </div>

                      <div
                        style={{
                          fontWeight: 700,
                        }}
                      >
                        $
                        {Number(
                          order.totalAmount,
                        ).toFixed(2)}
                      </div>

                      {order.shopifyOrderNumber ? (
                        <div
                          style={{
                            fontSize:
                              "12px",
                            color:
                              "#6d7175",
                            marginTop:
                              "2px",
                          }}
                        >
                          {
                            order.shopifyOrderNumber
                          }
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </s-section>
    </s-page>
  );
}
