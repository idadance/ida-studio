import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";
import {
  getEvents,
  getReservedQuantity,
  getRemainingCapacity,
} from "../services/event.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const events = await getEvents();

  return {
    events: events.map((event) => ({
      ...event,
      reservedQuantity: getReservedQuantity(event),
      remainingCapacity: getRemainingCapacity(event),
    })),
  };
};

export default function EventsPage() {
  const { events } = useLoaderData();

  return (
    <s-page heading="Events">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "20px",
        }}
      >
        <s-link href="/app/events/new">
          + Add Event
        </s-link>
      </div>

      <s-section>
        {events.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
            }}
          >
            <div
              style={{
                fontSize: "60px",
                marginBottom: "20px",
              }}
            >
              🎃
            </div>

            <h2>No Events Yet</h2>

            <p
              style={{
                maxWidth: "450px",
                margin: "0 auto",
              }}
            >
              Create an event to start accepting paid reservations.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            {events.map((event) => (
              <div
                key={event.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <strong
                  style={{
                    fontSize: "18px",
                  }}
                >
                  {event.name}
                </strong>

                {event.date && (
                  <div
                    style={{
                      marginTop: "8px",
                      color: "#666",
                    }}
                  >
                    📅{" "}
                    {new Date(event.date).toLocaleString()}
                  </div>
                )}

                {event.location && (
                  <div
                    style={{
                      marginTop: "6px",
                    }}
                  >
                    📍 {event.location}
                  </div>
                )}

                <div
                  style={{
                    marginTop: "12px",
                  }}
                >
                  <strong>
                    {event.reservedQuantity} / {event.capacity}
                  </strong>{" "}
                  spots reserved
                </div>

                <div
                  style={{
                    marginTop: "4px",
                  }}
                >
                  {event.remainingCapacity} spots remaining
                </div>

                <div
                  style={{
                    marginTop: "8px",
                  }}
                >
                  ${Number(event.price).toFixed(2)} per spot
                </div>

                <div
                  style={{
                    marginTop: "8px",
                  }}
                >
                  Status: {event.status}
                </div>

                <div
                  style={{
                    marginTop: "16px",
                  }}
                >
                  <s-link href={`/app/events/${event.id}`}>
                    Manage Event
                  </s-link>
                </div>
              </div>
            ))}
          </div>
        )}
      </s-section>
    </s-page>
  );
}