import { Form, useLoaderData, useNavigation } from "react-router";

import { authenticate } from "../shopify.server";
import {
  getEvent,
  getEventCapacitySummary,
  updateEvent,
  updateEventLocation,
} from "../services/event.server";

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);

  const event = await getEvent(params.id);

  if (!event) {
    throw new Response("Event not found", {
      status: 404,
    });
  }

  return {
    event,
    capacitySummary: getEventCapacitySummary(event),
  };
};

export const action = async ({ request, params }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "updateImage") {
  const imageUrl = String(
    formData.get("imageUrl") || "",
  ).trim();

  await updateEvent(params.id, {
    imageUrl,
  });

  return { success: true };
}

  if (intent === "updateLocationVariants") {
  const locationId = String(
    formData.get("locationId") || "",
  ).trim();

  const creditVariantId = String(
    formData.get("creditVariantId") || "",
  ).trim();

  const checkVariantId = String(
    formData.get("checkVariantId") || "",
  ).trim();

  if (locationId) {
    await updateEventLocation(locationId, {
      creditVariantId,
      checkVariantId,
    });
  }

  return { success: true };
}

  if (intent === "publish") {
    await updateEvent(params.id, {
      status: "PUBLISHED",
    });
  }

  if (intent === "unpublish") {
    await updateEvent(params.id, {
      status: "DRAFT",
    });
  }

  return { success: true };
};

export default function ManageEventPage() {
  const { event, capacitySummary } = useLoaderData();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading={event.name}>
      <div
        style={{
          marginBottom: "20px",
        }}
      >
        <s-link href="/app/events">
          ← Back to Events
        </s-link>
      </div>

      <s-section>
        <div
          style={{
            display: "grid",
            gap: "18px",
          }}
        >
          <div>
            <strong>Status:</strong> {event.status}
          </div>

          <div>
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value={
                  event.status === "PUBLISHED"
                    ? "unpublish"
                    : "publish"
                }
              />

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 18px",
                  cursor: isSubmitting
                    ? "default"
                    : "pointer",
                }}
              >
                {isSubmitting
                  ? "Saving..."
                  : event.status === "PUBLISHED"
                    ? "Unpublish Event"
                    : "Publish Event"}
              </button>
            </Form>
          </div>

          {event.date && (
            <div>
              <strong>Date &amp; Time:</strong>{" "}
              {new Date(event.date).toLocaleString()}
            </div>
          )}

          {event.description && (
            <div>
              <strong>Description:</strong>

              <div
                style={{
                  marginTop: "6px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {event.description}
              </div>
            </div>
          )}

          <div>
            <strong>Payment Methods:</strong>{" "}
            {[
              event.creditCardEnabled
                ? "Credit Card"
                : null,
              event.checkEnabled
                ? "Check"
                : null,
            ]
              .filter(Boolean)
              .join(" • ")}
          </div>
        </div>
      </s-section>

      <s-section heading="Event Photo">
  <Form method="post">
    <input
      type="hidden"
      name="intent"
      value="updateImage"
    />

    {event.imageUrl && (
      <div style={{ marginBottom: "16px" }}>
        <img
          src={event.imageUrl}
          alt={event.name}
          style={{
            display: "block",
            width: "100%",
            maxWidth: "500px",
            height: "260px",
            objectFit: "cover",
            borderRadius: "12px",
          }}
        />
      </div>
    )}

    <label
      style={{
        display: "block",
        maxWidth: "600px",
      }}
    >
      <div
        style={{
          fontWeight: "600",
          marginBottom: "6px",
        }}
      >
        Photo URL
      </div>

      <input
        type="url"
        name="imageUrl"
        defaultValue={event.imageUrl ?? ""}
        placeholder="https://..."
        style={{
          width: "100%",
          padding: "10px",
          boxSizing: "border-box",
        }}
      />
    </label>

    <div
      style={{
        marginTop: "12px",
        color: "#666",
        fontSize: "14px",
      }}
    >
      This photo will appear on the public Event page.
    </div>

    <button
      type="submit"
      disabled={isSubmitting}
      style={{ marginTop: "14px" }}
    >
      {isSubmitting ? "Saving..." : "Save Photo"}
    </button>
  </Form>
</s-section>

      <s-section heading="Studio Locations">
        <div
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          {capacitySummary.locations.map(
            (location) => (
              <div
                key={location.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  padding: "20px",
                }}
              >
                <strong
                  style={{
                    fontSize: "18px",
                  }}
                >
                  {location.studioCode === "FW"
                    ? "Fort Washington"
                    : location.studioCode === "PM"
                      ? "Plymouth Meeting"
                      : location.name}
                </strong>

                <div
                  style={{
                    marginTop: "12px",
                  }}
                >
                  <strong>
                    {location.reservedQuantity} /{" "}
                    {location.capacity}
                  </strong>{" "}
                  spots reserved
                </div>

                <div
                  style={{
                    marginTop: "5px",
                  }}
                >
                  {location.remainingCapacity} spots
                  remaining
                </div>

                <div
                  style={{
                    marginTop: "5px",
                  }}
                >
                  $
                  {Number(location.price).toFixed(2)} per
                  spot
                </div>

                <Form
  method="post"
  style={{
    marginTop: "18px",
    paddingTop: "16px",
    borderTop: "1px solid #ddd",
  }}
>
  <input
    type="hidden"
    name="intent"
    value="updateLocationVariants"
  />

  <input
    type="hidden"
    name="locationId"
    value={location.id}
  />

  <div
    style={{
      fontWeight: "600",
      marginBottom: "12px",
    }}
  >
    Shopify Checkout Setup
  </div>

  <label
    style={{
      display: "block",
      marginBottom: "12px",
    }}
  >
    <div style={{ marginBottom: "5px" }}>
      Credit Variant ID
    </div>

    <input
      type="text"
      name="creditVariantId"
      defaultValue={location.creditVariantId ?? ""}
      style={{
        width: "100%",
        padding: "8px",
        boxSizing: "border-box",
      }}
    />
  </label>

  <label
    style={{
      display: "block",
      marginBottom: "12px",
    }}
  >
    <div style={{ marginBottom: "5px" }}>
      Check Variant ID
    </div>

    <input
      type="text"
      name="checkVariantId"
      defaultValue={location.checkVariantId ?? ""}
      style={{
        width: "100%",
        padding: "8px",
        boxSizing: "border-box",
      }}
    />
  </label>

  <button type="submit" disabled={isSubmitting}>
    {isSubmitting ? "Saving..." : "Save Shopify IDs"}
  </button>
</Form>
              </div>
            ),
          )}
        </div>

        {capacitySummary.locations.length > 1 && (
          <div
            style={{
              marginTop: "18px",
              padding: "16px",
              border: "1px solid #ddd",
              borderRadius: "12px",
            }}
          >
            <strong>Overall Event Capacity</strong>

            <div
              style={{
                marginTop: "8px",
              }}
            >
              {capacitySummary.totalReserved} /{" "}
              {capacitySummary.totalCapacity} spots
              reserved
            </div>

            <div
              style={{
                marginTop: "4px",
              }}
            >
              {capacitySummary.totalRemaining} total spots
              remaining
            </div>
          </div>
        )}
      </s-section>

      <s-section heading="Reservations">
        {capacitySummary.totalReserved === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
            }}
          >
            <div
              style={{
                fontSize: "44px",
                marginBottom: "12px",
              }}
            >
              🎟️
            </div>

            <h2>No Reservations Yet</h2>

            <p>
              Reservations will appear here once
              registration opens.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "20px",
            }}
          >
            {event.locations.map((location) => (
              <div key={location.id}>
                <h3>{location.name}</h3>

                {location.reservations.map(
                  (reservation) => (
                    <div
                      key={reservation.id}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: "10px",
                        padding: "14px",
                        marginTop: "10px",
                      }}
                    >
                      <strong>
                        {reservation.customerName}
                      </strong>

                      <div>
                        {reservation.customerEmail}
                      </div>

                      <div
                        style={{
                          marginTop: "6px",
                        }}
                      >
                        Spots: {reservation.quantity}
                      </div>

                      <div>
                        Payment:{" "}
                        {reservation.paymentMethod ===
                        "CREDIT_CARD"
                          ? "Credit Card"
                          : "Check"}
                      </div>

                      <div>
                        Status: {reservation.status}
                      </div>

                      <div>
                        Total: $
                        {Number(
                          reservation.totalAmount,
                        ).toFixed(2)}
                      </div>
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        )}
      </s-section>
    </s-page>
  );
}