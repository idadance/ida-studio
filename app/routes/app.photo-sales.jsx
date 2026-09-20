import {
  useLoaderData,
} from "react-router";

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
      where: {
        studioCode: account,
      },

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

export default function PhotoSalesPage() {
  const {
    account,
    orders,
    summary,
    photographerPhotos,
    photoCounts,
  } = useLoaderData();

  return (
    <s-page
      heading="Photo Sales"
    >
      <s-section
        heading="Senior REP Photoshoot"
      >
        <s-stack
          direction="block"
          gap="base"
        >
          <s-text>
            Studio:{" "}
            {account === "FW"
              ? "Fort Washington"
              : "Plymouth Meeting"}
          </s-text>

          <s-text>
            Paid orders:{" "}
            {summary.paidOrders}
          </s-text>

          <s-text>
            Waiting for check:{" "}
            {summary.waitingForCheck}
          </s-text>

          <s-text>
            Purchased photos:{" "}
            {summary.purchasedPhotos}
          </s-text>

          <s-text>
            Unique photos:{" "}
            {summary.uniquePhotos}
          </s-text>
        </s-stack>
      </s-section>

      <s-section
        heading="Photographer List"
      >
        {photographerPhotos.length === 0 ? (
          <s-text>
            No paid photo orders yet.
          </s-text>
        ) : (
          <s-stack
            direction="block"
            gap="small"
          >
            <s-text>
              {photographerPhotos.join(
                ", ",
              )}
            </s-text>

            {photographerPhotos.map(
              (photoNumber) => (
                <s-text
                  key={photoNumber}
                >
                  {photoNumber}:{" "}
                  {photoCounts[
                    photoNumber
                  ]}{" "}
                  purchased
                </s-text>
              ),
            )}
          </s-stack>
        )}
      </s-section>

      <s-section
        heading="Orders"
      >
        {orders.length === 0 ? (
          <s-text>
            No photo orders yet.
          </s-text>
        ) : (
          <s-stack
            direction="block"
            gap="base"
          >
            {orders.map((order) => (
              <s-box
                key={order.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack
                  direction="block"
                  gap="small"
                >
                  <s-text
                    type="strong"
                  >
                    {order.dancerName}
                  </s-text>

                  <s-text>
                    Customer:{" "}
                    {order.customerName}
                  </s-text>

                  <s-text>
                    Photos:{" "}
                    {order.photos
                      .map(
                        (photo) =>
                          photo.photoNumber,
                      )
                      .sort(
                        (a, b) =>
                          Number(a) -
                          Number(b),
                      )
                      .join(", ")}
                  </s-text>

                  <s-text>
                    Payment:{" "}
                    {order.paymentMethod ===
                    "CHECK"
                      ? "Check"
                      : "Credit Card"}
                  </s-text>

                  <s-text>
                    Status:{" "}
                    {order.status}
                  </s-text>

                  <s-text>
                    Total: $
                    {Number(
                      order.totalAmount,
                    ).toFixed(2)}
                  </s-text>

                  {order.shopifyOrderNumber ? (
                    <s-text>
                      Shopify:{" "}
                      {
                        order.shopifyOrderNumber
                      }
                    </s-text>
                  ) : null}
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}
