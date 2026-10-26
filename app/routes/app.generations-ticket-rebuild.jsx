import {
  Form,
  useLoaderData,
  useNavigation,
} from "react-router";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { rebuildReservationTicketAssets } from "../services/ticketGenerator.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const reservations =
    await prisma.reservation.findMany({
      where: {
        status: "CONFIRMED",

        performance: {
          organization: "GENERATIONS",
        },
      },

      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        createdAt: true,
        driveFolderId: true,

        performance: {
          select: {
            name: true,
          },
        },

        ticketOrders: {
          where: {
            status: {
              not: "CANCELED",
            },
          },

          select: {
            id: true,
            quantity: true,
            ticketCode: true,
          },
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    });

  return {
    reservations,
  };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData =
    await request.formData();

  const intent = String(
    formData.get("intent") || "",
  );

  const confirmed =
    formData.get("confirmed");

  if (confirmed !== "yes") {
    throw new Response(
      "Ticket rebuild was not confirmed.",
      {
        status: 400,
      },
    );
  }

  // ======================================
  // REBUILD ONE RESERVATION
  // ======================================

  if (intent === "rebuild-one") {
    const reservationId =
      String(
        formData.get(
          "reservationId",
        ) || "",
      );

    if (!reservationId) {
      throw new Response(
        "Reservation ID is required.",
        {
          status: 400,
        },
      );
    }

    const reservation =
      await prisma.reservation.findFirst({
        where: {
          id: reservationId,
          status: "CONFIRMED",

          performance: {
            organization:
              "GENERATIONS",
          },
        },

        select: {
          id: true,
        },
      });

    if (!reservation) {
      throw new Response(
        "Confirmed Generations reservation not found.",
        {
          status: 404,
        },
      );
    }

    await rebuildReservationTicketAssets(
      reservation.id,
    );

    return {
      success: true,
      rebuilt: 1,
    };
  }

  // ======================================
  // REBUILD ALL GENERATIONS RESERVATIONS
  // ======================================

  if (intent === "rebuild-all") {
    const reservations =
      await prisma.reservation.findMany({
        where: {
          status: "CONFIRMED",

          driveFolderId: {
            not: null,
          },

          performance: {
            organization:
              "GENERATIONS",
          },
        },

        select: {
          id: true,
          driveFolderId: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    // One rebuild per customer Drive folder.
    //
    // rebuildReservationTicketAssets()
    // already finds every confirmed
    // reservation sharing that folder, so
    // rebuilding the same folder twice
    // would be unnecessary.
    const uniqueFolders =
      new Map();

    for (const reservation of reservations) {
      if (
        reservation.driveFolderId &&
        !uniqueFolders.has(
          reservation.driveFolderId,
        )
      ) {
        uniqueFolders.set(
          reservation.driveFolderId,
          reservation.id,
        );
      }
    }

    let rebuiltFolders = 0;

    for (const reservationId of uniqueFolders.values()) {
      await rebuildReservationTicketAssets(
        reservationId,
      );

      rebuiltFolders += 1;
    }

    return {
      success: true,
      rebuiltFolders,
    };
  }

  throw new Response(
    "Unknown Generations ticket rebuild action.",
    {
      status: 400,
    },
  );
};

export default function GenerationsTicketRebuildPage() {
  const { reservations } =
    useLoaderData();

  const navigation =
    useNavigation();

  const isSubmitting =
    navigation.state ===
    "submitting";

  const submittingIntent =
    navigation.formData?.get(
      "intent",
    );

  const rebuildingAll =
    isSubmitting &&
    submittingIntent ===
      "rebuild-all";

  return (
    <s-page heading="Generations Ticket PDF Rebuild">
      <s-section>
        <div
          style={{
            display: "grid",
            gap: "20px",
          }}
        >
          <div>
            <strong>
              Confirmed Generations reservations:
            </strong>{" "}
            {reservations.length}
          </div>

          {reservations.length >
            0 && (
            <div
              style={{
                border:
                  "2px solid #222",
                borderRadius:
                  "12px",
                padding: "18px",
              }}
            >
              <div
                style={{
                  fontWeight:
                    "bold",
                  marginBottom:
                    "8px",
                }}
              >
                Rebuild All Generations Ticket PDFs
              </div>

              <div
                style={{
                  marginBottom:
                    "14px",
                  lineHeight:
                    "1.5",
                }}
              >
                This replaces the
                existing ticket PDFs
                in each customer Drive
                folder using the
                existing ticket records
                and QR codes.
              </div>

              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="rebuild-all"
                />

                <input
                  type="hidden"
                  name="confirmed"
                  value="yes"
                />

                <button
                  type="submit"
                  disabled={
                    isSubmitting
                  }
                >
                  {rebuildingAll
                    ? "Rebuilding All Ticket PDFs..."
                    : "Rebuild All Generations Ticket PDFs"}
                </button>
              </Form>
            </div>
          )}

          {reservations.length ===
          0 ? (
            <div>
              No confirmed Generations
              reservations found.
            </div>
          ) : (
            reservations.map(
              (reservation) => {
                const ticketCount =
                  reservation.ticketOrders.reduce(
                    (
                      total,
                      order,
                    ) =>
                      total +
                      order.quantity,
                    0,
                  );

                const rebuildingThis =
                  isSubmitting &&
                  submittingIntent ===
                    "rebuild-one" &&
                  navigation.formData?.get(
                    "reservationId",
                  ) ===
                    reservation.id;

                return (
                  <div
                    key={
                      reservation.id
                    }
                    style={{
                      border:
                        "1px solid #ddd",
                      borderRadius:
                        "12px",
                      padding: "16px",
                    }}
                  >
                    <div>
                      <strong>
                        {
                          reservation.customerName
                        }
                      </strong>
                    </div>

                    <div>
                      {
                        reservation.customerEmail
                      }
                    </div>

                    <div>
                      Performance:{" "}
                      {
                        reservation.performance
                          .name
                      }
                    </div>

                    <div>
                      Tickets:{" "}
                      {ticketCount}
                    </div>

                    <div>
                      Drive folder:{" "}
                      {reservation.driveFolderId
                        ? "Yes"
                        : "Missing"}
                    </div>

                    <div
                      style={{
                        marginTop:
                          "12px",
                      }}
                    >
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="rebuild-one"
                        />

                        <input
                          type="hidden"
                          name="reservationId"
                          value={
                            reservation.id
                          }
                        />

                        <input
                          type="hidden"
                          name="confirmed"
                          value="yes"
                        />

                        <button
                          type="submit"
                          disabled={
                            isSubmitting ||
                            !reservation.driveFolderId
                          }
                        >
                          {rebuildingThis
                            ? "Rebuilding..."
                            : "Rebuild Ticket PDFs"}
                        </button>
                      </Form>
                    </div>
                  </div>
                );
              },
            )
          )}
        </div>
      </s-section>
    </s-page>
  );
}
