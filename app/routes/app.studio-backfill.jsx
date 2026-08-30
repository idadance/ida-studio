import {
  Form,
  redirect,
  useLoaderData,
  useNavigation,
} from "react-router";

import { authenticate } from "../shopify.server";

import {
  previewStudioBackfill,
  assignStudioBackfill,
  archiveTestReservations,
} from "../services/studioBackfill.server";

export const loader = async ({ request }) => {
  const { admin, session } =
    await authenticate.admin(request);

  const preview =
    await previewStudioBackfill({
      admin,
    });

  return {
    shop: session.shop,
    preview,
  };
};

export const action = async ({ request }) => {
  const { admin, session } =
    await authenticate.admin(request);

  const formData =
    await request.formData();

  const intent =
    formData.get("intent");

  // ======================================
  // ARCHIVE VERIFIED TEST RESERVATIONS
  // ======================================

  if (intent === "archive-tests") {
    const confirmed =
      formData.get(
        "archiveConfirmed",
      );

    if (confirmed !== "yes") {
      throw new Response(
        "Test reservation archive was not confirmed.",
        {
          status: 400,
        },
      );
    }

    const reservationIds =
      formData
        .getAll("reservationId")
        .map(String);

    if (
      reservationIds.length === 0
    ) {
      throw new Response(
        "No test reservations were supplied.",
        {
          status: 400,
        },
      );
    }

    await archiveTestReservations({
      reservationIds,
    });

    return redirect(
      "/app/studio-backfill",
    );
  }

  // ======================================
  // ASSIGN STUDIO
  // ======================================

  if (intent === "assign-studio") {
    const confirmed =
      formData.get("confirmed");

    if (confirmed !== "yes") {
      throw new Response(
        "Studio assignment was not confirmed.",
        {
          status: 400,
        },
      );
    }

    const shop = session.shop;

    let account;

    if (
      shop ===
      "ida-dance-store.myshopify.com"
    ) {
      account = "FW";
    } else if (
      shop ===
      "ida-dance-store-pm.myshopify.com"
    ) {
      account = "PM";
    } else {
      throw new Response(
        "This Shopify store is not recognized as an IDA studio.",
        {
          status: 400,
        },
      );
    }

    await assignStudioBackfill({
      admin,
      account,
    });

    return redirect(
      "/app/studio-backfill",
    );
  }

  throw new Response(
    "Unknown Studio Backfill action.",
    {
      status: 400,
    },
  );
};

function SummaryCard({
  title,
  value,
  detail,
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <div>{title}</div>

      <strong
        style={{
          fontSize: "28px",
          display: "block",
          marginTop: "4px",
        }}
      >
        {value}
      </strong>

      {detail && (
        <div
          style={{
            marginTop: "8px",
            lineHeight: "1.6",
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}

export default function StudioBackfillPage() {
  const { shop, preview } =
    useLoaderData();

  const navigation =
    useNavigation();

  const isAssigning =
    navigation.state ===
    "submitting";

  const isFW =
    shop ===
    "ida-dance-store.myshopify.com";

  const studioName = isFW
    ? "Fort Washington"
    : "Plymouth Meeting";

  return (
    <s-page heading="Studio Backfill">
      <s-section>
        <div
          style={{
            display: "grid",
            gap: "20px",
          }}
        >
          <div>
            <strong>
              Current Shopify Store:
            </strong>{" "}
            {studioName}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
            }}
          >
            <SummaryCard
              title="Unassigned Reservations"
              value={
                preview.totalUnassigned
              }
            />

            <SummaryCard
              title={`Found in ${studioName}`}
              value={
                preview.foundInCurrentStore
              }
              detail={
                <>
                  <div>
                    Check:{" "}
                    <strong>
                      {preview.foundChecks}
                    </strong>
                  </div>

                  <div>
                    Credit Card:{" "}
                    <strong>
                      {
                        preview.foundCreditCards
                      }
                    </strong>
                  </div>
                </>
              }
            />

            <SummaryCard
              title="Not Found Here"
              value={
                preview.notFoundInCurrentStore
              }
              detail={
                <>
                  <div>
                    Check:{" "}
                    <strong>
                      {
                        preview.notFoundChecks
                      }
                    </strong>
                  </div>

                  <div>
                    Credit Card:{" "}
                    <strong>
                      {
                        preview.notFoundCreditCards
                      }
                    </strong>
                  </div>
                </>
              }
            />

            <SummaryCard
              title="Missing Shopify ID"
              value={
                preview.noShopifyId
              }
            />
          </div>

          {preview.foundInCurrentStore >
            0 && (
            <div
              style={{
                border:
                  "2px solid #ddd",
                borderRadius: "12px",
                padding: "18px",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                Assign Existing
                Reservations
              </h2>

              <p>
                Shopify positively
                identified{" "}
                <strong>
                  {
                    preview.foundInCurrentStore
                  }
                </strong>{" "}
                unassigned reservation
                {preview.foundInCurrentStore ===
                1
                  ? ""
                  : "s"}{" "}
                as belonging to{" "}
                <strong>
                  {studioName}
                </strong>
                .
              </p>

              <p>
                Only those reservations
                will be assigned. Anything
                listed under Not Found
                Here will remain
                untouched.
              </p>

              <Form method="post">
                <input
  type="hidden"
  name="intent"
  value="assign-studio"
/>
                <div
                  style={{
                    marginBottom:
                      "14px",
                  }}
                >
                  <label>
                    <input
                      type="checkbox"
                      name="confirmed"
                      value="yes"
                      required
                    />{" "}
                    I confirm these
                    reservations should be
                    assigned to{" "}
                    {studioName}.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={
                    isAssigning
                  }
                  style={{
                    padding:
                      "10px 16px",
                    fontWeight: "600",
                    cursor:
                      isAssigning
                        ? "wait"
                        : "pointer",
                  }}
                >
                  {isAssigning
                    ? "Assigning..."
                    : `Assign ${preview.foundInCurrentStore} to ${studioName}`}
                </button>
              </Form>
            </div>
          )}

          <div>
            <h2>
              Found in {studioName}
            </h2>

            {preview.found.length ===
            0 ? (
              <p>
                No unassigned
                reservations were found
                in this store.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                }}
              >
                {preview.found.map(
                  (reservation) => (
                    <div
                      key={
                        reservation.id
                      }
                      style={{
                        border:
                          "1px solid #ddd",
                        borderRadius:
                          "10px",
                        padding:
                          "12px",
                      }}
                    >
                      <strong>
                        {
                          reservation.customerName
                        }
                      </strong>

                      <div>
                        {
                          reservation.customerEmail
                        }
                      </div>

                      <div>
                        {
                          reservation.performance
                        }
                      </div>

                      <div>
                        Payment:{" "}
                        {
                          reservation.paymentMethod
                        }
                      </div>

                      <div>
                        Shopify:{" "}
                        {reservation.shopifyOrderNumber ||
                          "No order number"}
                      </div>

                      <div>
                        Shopify Type:{" "}
                        {reservation.shopifyType ||
                          "Unknown"}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          <div>
            <h2>
              Not Found in{" "}
              {studioName}
            </h2>

            <p>
              These reservations were not
              recognized by this Shopify
              store and will not be
              changed.
            </p>

            {preview.notFound.length ===
            0 ? (
              <p>None.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                }}
              >
                {preview.notFound.map(
                  (reservation) => (
                    <div
                      key={
                        reservation.id
                      }
                      style={{
                        border:
                          "1px solid #ddd",
                        borderRadius:
                          "10px",
                        padding:
                          "12px",
                      }}
                    >
                      <strong>
                        {
                          reservation.customerName
                        }
                      </strong>

                      <div>
                        {
                          reservation.customerEmail
                        }
                      </div>

                      <div>
                        {
                          reservation.performance
                        }
                      </div>

                      <div>
                        Payment:{" "}
                        {
                          reservation.paymentMethod
                        }
                      </div>

                      <div>
                        Shopify:{" "}
                        {reservation.shopifyOrderNumber ||
                          "No order number"}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {preview.totalUnassigned > 0 &&
  preview.foundInCurrentStore === 0 &&
  preview.foundCreditCards === 0 &&
  preview.notFoundCreditCards === 0 &&
  preview.noShopifyId === 0 && (
    <div
      style={{
        border: "2px solid #ddd",
        borderRadius: "12px",
        padding: "18px",
      }}
    >
      <h2
        style={{
          marginTop: 0,
        }}
      >
        Archive Verified Test
        Reservations
      </h2>

      <p>
        There are{" "}
        <strong>
          {preview.totalUnassigned}
        </strong>{" "}
        remaining unassigned
        reservations.
      </p>

      <p>
        These have been manually
        verified as test orders. This
        will not delete them. Their
        reservations will be marked
        CANCELLED and their ticket
        records will be marked
        CANCELED.
      </p>

      <Form method="post">
        <input
          type="hidden"
          name="intent"
          value="archive-tests"
        />

        {preview.notFound.map(
          (reservation) => (
            <input
              key={reservation.id}
              type="hidden"
              name="reservationId"
              value={reservation.id}
            />
          ),
        )}

        <div
          style={{
            marginBottom: "14px",
          }}
        >
          <label>
            <input
              type="checkbox"
              name="archiveConfirmed"
              value="yes"
              required
            />{" "}
            I confirm these{" "}
            {preview.totalUnassigned}{" "}
            reservations are test
            orders and should be
            archived.
          </label>
        </div>

        <button
          type="submit"
          disabled={isAssigning}
          style={{
            padding: "10px 16px",
            fontWeight: "600",
            cursor: isAssigning
              ? "wait"
              : "pointer",
          }}
        >
          {isAssigning
            ? "Archiving..."
            : `Archive ${preview.totalUnassigned} Test Reservations`}
        </button>
      </Form>
    </div>
  )}

          {preview.missingShopifyId
            .length > 0 && (
            <div>
              <h2>
                ⚠️ Missing Shopify ID
              </h2>

              <p>
                These reservations cannot
                currently be identified
                through Shopify and will
                not be changed.
              </p>

              {preview.missingShopifyId.map(
                (reservation) => (
                  <div
                    key={
                      reservation.id
                    }
                    style={{
                      border:
                        "1px solid #ddd",
                      borderRadius:
                        "10px",
                      padding:
                        "12px",
                      marginBottom:
                        "10px",
                    }}
                  >
                    <strong>
                      {
                        reservation.customerName
                      }
                    </strong>

                    <div>
                      {
                        reservation.customerEmail
                      }
                    </div>

                    <div>
                      {
                        reservation.performance
                      }
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </s-section>
    </s-page>
  );
}