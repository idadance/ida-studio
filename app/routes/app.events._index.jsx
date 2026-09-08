import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";
import {
  getEvents,
  getEventCapacitySummary,
} from "../services/event.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const events = await getEvents();

  return {
    events: events.map((event) => ({
      ...event,
      capacitySummary: getEventCapacitySummary(event),
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
              gap: "16px",
            }}
          >
            {events.map((event) => (
              <div
                key={event.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  padding: "20px",
                }}
              >
                <strong
                  style={{
                    fontSize: "20px",
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

                <div
                  style={{
                    marginTop: "10px",
                  }}
                >
                  Status: {event.status}
                </div>

                {event.locations.length === 0 ? (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "14px",
                      border: "1px solid #ddd",
                      borderRadius: "10px",
                      color: "#666",
                    }}
                  >
                    No studio locations have been added to this event.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      marginTop: "18px",
                    }}
                  >
                    {event.capacitySummary.locations.map((location) => (
                      <div
                        key={location.id}
                        style={{
                          border: "1px solid #ddd",
                          borderRadius: "10px",
                          padding: "14px",
                        }}
                      >
                        <strong>
                          {location.studioCode === "FW"
                            ? "Fort Washington"
                            : location.studioCode === "PM"
                              ? "Plymouth Meeting"
                              : location.name}
                        </strong>

                        <div
                          style={{
                            marginTop: "8px",
                          }}
                        >
                          <strong>
                            {location.reservedQuantity} / {location.capacity}
                          </strong>{" "}
                          spots reserved
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                          }}
                        >
                          {location.remainingCapacity} spots remaining
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                          }}
                        >
                          ${Number(location.price).toFixed(2)} per spot
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {event.locations.length > 1 && (
                  <div
                    style={{
                      marginTop: "14px",
                      color: "#666",
                    }}
                  >
                    Total:{" "}
                    <strong>
                      {event.capacitySummary.totalReserved} /{" "}
                      {event.capacitySummary.totalCapacity}
                    </strong>{" "}
                    spots reserved across all locations
                  </div>
                )}

                <div
                  style={{
                    marginTop: "18px",
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