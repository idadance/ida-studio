import {
  Form,
  redirect,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "react-router";

import { useState } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

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

    const url =
  new URL(request.url);

const requestedPerformanceId =
  url.searchParams.get(
    "performance",
  );

const requestedEventId =
  url.searchParams.get(
    "event",
  );

  const soloDuetSelected =
  url.searchParams.get(
    "soloDuet",
  ) === "true";

  const photoSalesSelected =
  url.searchParams.get(
    "photoSales",
  ) === "true";

  const eventChecks =
  await prisma.eventReservation.findMany({
    where: {
      paymentMethod: "CHECK",
      status: "PENDING",
      eventLocation: {
        studioCode: account,
      },
    },
    include: {
      attendees: {
        orderBy: {
          createdAt: "asc",
        },
      },
      eventLocation: {
        include: {
          event: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const soloDuetChecks =
  await prisma.soloDuetRegistration.findMany({
    where: {
      studioCode: account,
      paymentMethod: "CHECK",
      paymentStatus: "PENDING",
      paymentResponsibility: {
        not: "PARTNER",
      },
      shopifyOrderId: {
        not: null,
      },
    },

    include: {
      teacher: true,
      genre: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const photoChecks =
  await prisma.photoOrder.findMany({
    where: {
      studioCode: account,
      paymentMethod: "CHECK",
      status: "PENDING",
      shopifyOrderId: {
        not: null,
      },
    },

    include: {
      photos: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const performances =
  await prisma.performance.findMany({
    where: {
      status: "PUBLISHED",
    },

    select: {
      id: true,
      name: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

const events =
  await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
    },

    select: {
      id: true,
      name: true,
      date: true,
    },

    orderBy: {
      date: "desc",
    },
  });

  const selectedEventId =
  requestedEventId &&
  events.some(
    (event) =>
      event.id === requestedEventId,
  )
    ? requestedEventId
    : null;

const selectedPerformanceId =
  requestedPerformanceId &&
  performances.some(
    (performance) =>
      performance.id ===
      requestedPerformanceId,
  )
    ? requestedPerformanceId
    : selectedEventId ||
    soloDuetSelected ||
    photoSalesSelected
      ? null
      : performances[0]?.id ?? null;

return {
  account,

  performances,

  events,

  selectedPerformanceId,
selectedEventId,
soloDuetSelected,
photoSalesSelected,

  waiting:
    await getWaitingForCheckQueue(
      account,
    ),

    eventChecks,
  soloDuetChecks,
  photoChecks,
};
};

export const action = async ({
  request,
}) => {
  const {
  receiveEventCheck,
  receiveSoloDuetCheck,
} = await import(
  "../services/queue.server"
);

  const { admin, session } =
    await authenticate.admin(request);

  const account =
    getAccountFromShop(
      session.shop,
    );

  const formData =
    await request.formData();

    const checkNumber =
  formData.get("checkNumber");

  const reservationId =
    formData.get(
      "reservationId",
    );

  const showId =
    formData.get(
      "showId",
    );

    const reservationType =
  formData.get(
    "reservationType",
  );

  if (
  reservationType === "solo-duet"
) {
  if (!reservationId) {
    throw new Response(
      "Solo/Duet registration ID is required.",
      {
        status: 400,
      },
    );
  }

  await receiveSoloDuetCheck({
  registrationId:
    String(reservationId),

  checkNumber:
    String(checkNumber || "").trim(),

  admin,

  account,
});

  return redirect(
    "/app/queue?soloDuet=true",
  );
}

  if (
  reservationType === "event"
) {
  if (!reservationId) {
    throw new Response(
      "Event reservation ID is required.",
      {
        status: 400,
      },
    );
  }

  await receiveEventCheck({
    reservationId:
      String(reservationId),

    admin,

    account,
  });

  return redirect(
    `/app/queue?event=${String(
      formData.get("eventId"),
    )}`,
  );
}

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
  const navigate = useNavigate();
  const {
  waiting,
  eventChecks,
  soloDuetChecks,
  photoChecks,
  performances,
  events,
  selectedPerformanceId,
  selectedEventId,
  soloDuetSelected,
  photoSalesSelected,
  account,
} = useLoaderData();

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

      const selectedEventChecks =
  selectedEventId
    ? eventChecks.filter(
        (reservation) =>
          reservation.eventLocation
            ?.event?.id ===
          selectedEventId,
      )
    : [];

    const filteredEventChecks =
  normalizedSearch
    ? selectedEventChecks.filter(
        (reservation) => {
          const searchableText = [
            reservation.customerName,
            reservation.customerEmail,
            reservation.eventLocation
              ?.event?.name,
            reservation.eventLocation
              ?.name,
            ...(reservation.attendees ?? []).flatMap(
              (attendee) => [
                attendee.name,
                attendee.grade,
              ],
            ),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            normalizedSearch,
          );
        },
      )
    : selectedEventChecks;

  const performanceWaiting =
  selectedPerformanceId
    ? waiting.filter(
        (family) =>
          family.performanceId ===
          selectedPerformanceId,
      )
    : [];

const filteredWaiting =
  normalizedSearch
    ? performanceWaiting.filter(
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
    : performanceWaiting;

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
      Performance / Event
    </div>

    <select
      value={
  photoSalesSelected
    ? "photo-sales"
    : soloDuetSelected
      ? "solo-duet"
      : selectedEventId
        ? `event:${selectedEventId}`
        : selectedPerformanceId
          ? `performance:${selectedPerformanceId}`
          : ""
}
      onChange={(event) => {
        const value =
          event.target.value;

          if (value === "solo-duet") {
  navigate(
    "/app/queue?soloDuet=true",
  );
  return;
}

if (value === "photo-sales") {
  navigate(
    "/app/queue?photoSales=true",
  );
  return;
}

        if (
          value.startsWith(
            "event:",
          )
        ) {
          navigate(
            `/app/queue?event=${value.replace(
              "event:",
              "",
            )}`,
          );
          return;
        }

        if (
          value.startsWith(
            "performance:",
          )
        ) {
          navigate(
            `/app/queue?performance=${value.replace(
              "performance:",
              "",
            )}`,
          );
        }
      }}
      style={{
        width: "100%",
        maxWidth: "620px",
        padding: "10px 12px",
        boxSizing: "border-box",
      }}
    >
      <optgroup label="PERFORMANCES">
        {performances.map(
          (performance) => (
            <option
              key={
                performance.id
              }
              value={`performance:${performance.id}`}
            >
              {
                performance.name
              }
            </option>
          ),
        )}
      </optgroup>

      <optgroup label="EVENTS">
        {events.map(
          (event) => (
            <option
              key={event.id}
              value={`event:${event.id}`}
            >
              {event.name}
            </option>
          ),
        )}
      </optgroup>
      <optgroup label="SOLO / DUET">
  <option value="solo-duet">
    Solo/Duet Registration
  </option>
</optgroup>
<optgroup label="PHOTO SALES">
  <option value="photo-sales">
    Senior REP Photos
  </option>
</optgroup>
    </select>
  </label>
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

        {photoSalesSelected ? (
  photoChecks.length === 0 ? (
    <p>
      🎉 No photo orders are currently waiting for checks.
    </p>
  ) : (
    <div
      style={{
        display: "grid",
        gap: "16px",
      }}
    >
      {photoChecks.map((order) => (
        <div
          key={order.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <h3
            style={{
              marginTop: 0,
            }}
          >
            {order.customerName}
          </h3>

          <p>{order.customerEmail}</p>

          <p>
            <strong>Dancer:</strong>{" "}
            {order.dancerName}
          </p>

          <p>
            <strong>Photos:</strong>{" "}
            {order.photos
              .map(
                (photo) =>
                  photo.photoNumber,
              )
              .join(", ")}
          </p>

          <p>
            💲
            {order.totalAmount.toFixed(
              2,
            )}
          </p>

          <p>
            Shopify:{" "}
            {order.shopifyOrderNumber ??
              "Draft Order"}
          </p>
        </div>
      ))}
    </div>
  )
) : soloDuetSelected ? (
  soloDuetChecks.length === 0 ? (
    <p>
      🎉 No Solo/Duet registrations are currently waiting for checks.
    </p>
  ) : (
    <div
      style={{
        display: "grid",
        gap: "16px",
      }}
    >
      {soloDuetChecks.map(
        (registration) => (
          <div
            key={registration.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <h3
              style={{
                marginTop: 0,
              }}
            >
              {registration.studentFirstName}{" "}
              {registration.studentLastName}
            </h3>

            {registration.customerEmail && (
              <p>
                {registration.customerEmail}
              </p>
            )}

            <p>
              <strong>
                Solo/Duet Registration
              </strong>
            </p>

            <p>
              {registration.entryType}
              {registration.genre?.name
                ? ` · ${registration.genre.name}`
                : ""}
            </p>

            <p>
              Grade {registration.grade}
            </p>

            <p>
              💲
              {registration.totalAmount.toFixed(
                2,
              )}
            </p>

            <p>
              Shopify:{" "}
              {registration.shopifyOrderNumber ??
                "Draft Order"}
            </p>
            <Form method="post">
  <input
    type="hidden"
    name="reservationId"
    value={registration.id}
  />

  <input
    type="hidden"
    name="reservationType"
    value="solo-duet"
  />

  <s-button
    type="submit"
    variant="primary"
    disabled={
      navigation.state ===
        "submitting" &&
      submittingReservationId ===
        registration.id
    }
    loading={
      navigation.state ===
        "submitting" &&
      submittingReservationId ===
        registration.id
    }
  >
    {navigation.state ===
      "submitting" &&
    submittingReservationId ===
      registration.id
      ? "Receiving Check..."
      : "Receive Check"}
  </s-button>
</Form>
          </div>
        ),
      )}
    </div>
  )
) : selectedEventId ? (
  filteredEventChecks.length === 0 ? (
    <p>
      {searchTerm
        ? "No matching event reservations found."
        : "🎉 No event registrations are currently waiting for checks."}
    </p>
  ) : (
    <div
      style={{
        display: "grid",
        gap: "16px",
      }}
    >
      {filteredEventChecks.map(
        (reservation) => (
          <div
            key={reservation.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <h3
              style={{
                marginTop: 0,
              }}
            >
              {reservation.customerName}
            </h3>

            {reservation.customerEmail && (
              <p>
                {reservation.customerEmail}
              </p>
            )}

            <p>
              <strong>
                {
                  reservation.eventLocation
                    ?.event?.name
                }
              </strong>
            </p>

            <p>
              {
                reservation.eventLocation
                  ?.name
              }
            </p>

            <p>
              🎟{" "}
              {reservation.quantity}{" "}
              {reservation.quantity === 1
                ? "Spot"
                : "Spots"}
            </p>

            <p>
              💲
              {reservation.totalAmount.toFixed(
                2,
              )}
            </p>

            {(reservation.attendees ?? [])
              .length > 0 && (
              <div>
                <strong>
                  {reservation.attendees.length ===
                  1
                    ? "Dancer:"
                    : "Dancers:"}
                </strong>

                {reservation.attendees.map(
                  (attendee) => (
                    <div
                      key={attendee.id}
                      style={{
                        marginTop: "4px",
                      }}
                    >
                      {attendee.name}
                      {attendee.grade
                        ? ` — ${attendee.grade}`
                        : ""}
                    </div>
                  ),
                )}
              </div>
            )}
            <Form method="post">
              <div
  style={{
    marginBottom: "12px",
    maxWidth: "220px",
  }}
>
  <label
    htmlFor={`check-number-${registration.id}`}
    style={{
      display: "block",
      marginBottom: "6px",
      fontWeight: "600",
    }}
  >
    Check Number
  </label>

  <input
    id={`check-number-${registration.id}`}
    name="checkNumber"
    type="text"
    inputMode="numeric"
    placeholder="Enter check number"
    required
    style={{
      width: "100%",
      padding: "8px 10px",
      border: "1px solid #ccc",
      borderRadius: "6px",
    }}
  />
</div>
  <input
    type="hidden"
    name="reservationId"
    value={reservation.id}
  />

  <input
    type="hidden"
    name="reservationType"
    value="event"
  />

  <input
    type="hidden"
    name="eventId"
    value={selectedEventId}
  />

  <s-button
  type="submit"
  variant="primary"
  disabled={
    navigation.state ===
      "submitting" &&
    submittingReservationId ===
      reservation.id
  }
  loading={
    navigation.state ===
      "submitting" &&
    submittingReservationId ===
      reservation.id
  }
>
  {navigation.state ===
      "submitting" &&
    submittingReservationId ===
      reservation.id
    ? "Receiving Check..."
    : "Receive Check"}
</s-button>
</Form>
          </div>
        ),
      )}
    </div>
  )
) : filteredWaiting.length === 0 ? (
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
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <h3
              style={{
                marginTop: 0,
              }}
            >
              {family.customerName}
            </h3>

            {family.customerEmail && (
              <p>
                {family.customerEmail}
              </p>
            )}

            <p>
              <strong>
                {family.performance}
              </strong>
            </p>

            <p>
              {family.showName}
            </p>

            <p>
              🎟 {family.tickets} Tickets
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
                value={family.showId}
              />

              <s-button
                type="submit"
                variant="primary"
                disabled={isReceiving}
                loading={isReceiving}
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