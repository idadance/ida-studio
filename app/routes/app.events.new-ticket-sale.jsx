import { Form, redirect, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import { createTicketSaleEvent } from "../services/event.server";


function easternDateTimeToISOString(value) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  let timestamp = wallTime;

  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );

    const displayedTime = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );

    timestamp += wallTime - displayedTime;
  }

  return new Date(timestamp).toISOString();
}

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const dateValue = String(formData.get("date") || "");

  if (!name || !dateValue) {
    return { error: "Event name and game date are required." };
  }

  const ticketTiers = [];

  for (let i = 0; i < 3; i++) {
    const price = Number(formData.get(`price-${i}`));
    const capacity = Number(formData.get(`capacity-${i}`));

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isSafeInteger(capacity) ||
      capacity < 1
    ) {
      return { error: `Invalid price or quantity for ticket tier ${i + 1}.` };
    }

    ticketTiers.push({
      name: `$${price.toFixed(2)} Tickets`,
      price,
      capacity,
    });
  }

  const event = await createTicketSaleEvent({
    name,
    description,
    date: easternDateTimeToISOString(dateValue),
    ticketTiers,
  });

  return redirect(`/app/events/${event.id}`);
};

export default function NewTicketSalePage() {
  const tiers = [
    { price: 49, capacity: 154 },
    { price: 75, capacity: 98 },
    { price: 116, capacity: 128 },
  ];

  return (
    <s-page heading="Add Ticket Sale">
      <s-section>
        <div style={{ maxWidth: "700px" }}>
          <p>
            Create a ticket sale with inventory shared
            between Fort Washington and Plymouth Meeting.
          </p>

          <Form method="post">
            <div style={{ display: "grid", gap: "20px" }}>
              <div>
                <label htmlFor="name">
                  <strong>Event Name</strong>
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue="Philadelphia 76ers Game"
                  required
                />
              </div>

              <div>
                <label htmlFor="description">
                  <strong>Description</strong>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows="3"
                  defaultValue="Join IDA for a Philadelphia 76ers game! Tickets will be delivered separately through Ticketmaster."
                />
              </div>

              <div>
                <label htmlFor="date">
                  <strong>Game Date & Time</strong>
                </label>
                <input
                  id="date"
                  name="date"
                  type="datetime-local"
                  required
                />
              </div>

              <h3>Ticket Prices & Inventory</h3>

              {tiers.map((tier, index) => (
                <div
                  key={tier.price}
                  style={{
                    display: "flex",
                    gap: "20px",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <label htmlFor={`price-${index}`}>
                      Ticket Price
                    </label>
                    <input
                      id={`price-${index}`}
                      name={`price-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={tier.price}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor={`capacity-${index}`}>
                      Quantity Available
                    </label>
                    <input
                      id={`capacity-${index}`}
                      name={`capacity-${index}`}
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={tier.capacity}
                      required
                    />
                  </div>
                </div>
              ))}

              <p>
                Total starting inventory: 380 tickets.
                Both studios share the same inventory.
              </p>

              <p>
                Credit card payments include a 2.6% fee.
                Check payments have no fee.
              </p>

              <button type="submit">
                Create Ticket Sale
              </button>
            </div>
          </Form>
        </div>
      </s-section>
    </s-page>
  );
}
