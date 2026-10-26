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

  const reservationId =
    String(
      formData.get("reservationId") ||
        "",
    );

  const confirmed =
    formData.get("confirmed");

  if (
    !reservationId ||
    confirmed !== "yes"
  ) {
    throw new Response(
      "Ticket rebuild was not confirmed.",
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
          organization: "GENERATIONS",
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
    reservationId:
      reservation.id,
  };
};

export default function GenerationsTicketRebuildPage() {
  const { reservations } =
    useLoaderData();

  const navigation =
    useNavigation();

  const isSubmitting =
    navigation.state ===
    "submitting";

  return (
    <s-page heading="Generations Ticket PDF Rebuild">
      <s-section>
        <div
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          <div>
            <strong>
              Confirmed Generations reservations:
            </strong>{" "}
            {reservations.length}
          </div>

          {reservations.length === 0 ? (
            <div>
              No confirmed Generations
              reservations found.
            </div>
          ) : (
            reservations.map(
              (reservation) => {
                const ticketCount =
                  reservation.ticketOrders.reduce(
                    (total, order) =>
                      total +
                      order.quantity,
                    0,
                  );

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
                          {isSubmitting
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
