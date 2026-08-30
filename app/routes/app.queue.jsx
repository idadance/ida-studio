import {
  Form,
  redirect,
  useLoaderData,
  useNavigation,
} from "react-router";

import { useState } from "react";

import { authenticate } from "../shopify.server";

import { getWaitingForCheckQueue } from "../services/productionDashboard.server";

import { receiveCheck } from "../services/queue.server";

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
    getAccountFromShop(
      session.shop,
    );

  return {
    account,

    waiting:
      await getWaitingForCheckQueue(
        account,
      ),
  };
};

export const action = async ({
  request,
}) => {
  const { admin, session } =
    await authenticate.admin(request);

  const account =
    getAccountFromShop(
      session.shop,
    );

  const formData =
    await request.formData();

  const reservationId =
    formData.get(
      "reservationId",
    );

  const showId =
    formData.get(
      "showId",
    );

  if (
    !reservationId ||
    !showId
  ) {
    throw new Response(
      "Reservation ID and Show ID are required.",
      {
        status: 400,
      },
    );
  }

  await receiveCheck({
    reservationId:
      String(reservationId),

    showId:
      String(showId),

    checkNumber: "",

    admin,

    account,
  });

  return redirect("/app/queue");
};

export default function QueuePage() {
  const { waiting, account } =
    useLoaderData();

  const navigation =
    useNavigation();

  const [searchTerm, setSearchTerm] =
    useState("");

  const submittingReservationId =
    navigation.formData?.get(
      "reservationId",
    );

    const submittingShowId =
  navigation.formData?.get(
    "showId",
  );

  const studioName =
    account === "FW"
      ? "Fort Washington"
      : "Plymouth Meeting";

  const normalizedSearch =
    searchTerm
      .trim()
      .toLowerCase();

  const filteredWaiting =
    normalizedSearch
      ? waiting.filter(
          (family) => {
            const searchableText = [
              family.customerName,
              family.customerEmail,
              family.performance,
              family.showName,
              family.reservationId,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return searchableText.includes(
              normalizedSearch,
            );
          },
        )
      : waiting;

  return (
    <s-page heading="Waiting for Check">
      <s-section>
        <div
          style={{
            marginBottom: "16px",
          }}
        >
          <strong>
            {studioName}
          </strong>
        </div>

        <div
          style={{
            marginBottom: "20px",
          }}
        >
          <label>
            <div
              style={{
                marginBottom: "6px",
                fontWeight: "600",
              }}
            >
              Search Waiting for Checks
            </div>

            <input
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value,
                )
              }
              placeholder="Search by customer, email, performance, or show"
              style={{
                width: "100%",
                maxWidth: "620px",
                padding: "10px 12px",
                boxSizing: "border-box",
              }}
            />
          </label>
        </div>

        {filteredWaiting.length ===
        0 ? (
          <p>
            {searchTerm
              ? "No matching families found."
              : "🎉 No families are currently waiting for checks."}
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "16px",
            }}
          >
            {filteredWaiting.map(
              (family) => {
                const isReceiving =
  navigation.state ===
    "submitting" &&
  submittingReservationId ===
    family.reservationId &&
  submittingShowId ===
    family.showId;

                return (
                  <div
                    key={family.id}
                    style={{
                      border:
                        "1px solid #ddd",
                      borderRadius:
                        "12px",
                      padding:
                        "16px",
                    }}
                  >
                    <h3
                      style={{
                        marginTop: 0,
                      }}
                    >
                      {
                        family.customerName
                      }
                    </h3>

                    {family.customerEmail && (
                      <p>
                        {
                          family.customerEmail
                        }
                      </p>
                    )}

                    <p>
                      <strong>
                        {
                          family.performance
                        }
                      </strong>
                    </p>

                    <p>
                      {family.showName}
                    </p>

                    <p>
                      🎟{" "}
                      {family.tickets}{" "}
                      Tickets
                    </p>

                    <p>
                      💲
                      {family.amountDue.toFixed(
                        2,
                      )}
                    </p>

                    <Form method="post">
                      <input
                        type="hidden"
                        name="reservationId"
                        value={
                          family.reservationId
                        }
                      />

                      <input
                        type="hidden"
                        name="showId"
                        value={
                          family.showId
                        }
                      />

                      <s-button
                        type="submit"
                        variant="primary"
                        disabled={
                          isReceiving
                        }
                        loading={
                          isReceiving
                        }
                      >
                        {isReceiving
                          ? "Receiving Check..."
                          : "Receive Check"}
                      </s-button>
                    </Form>
                  </div>
                );
              },
            )}
          </div>
        )}
      </s-section>
    </s-page>
  );
}