import { Form, redirect, useActionData, useNavigation } from "react-router";

import { authenticate } from "../shopify.server";
import { createEvent } from "../services/event.server";

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();

  const name = formData.get("name")?.trim();
  const description = formData.get("description")?.trim();
  const date = formData.get("date");

  const creditCardEnabled =
    formData.get("creditCardEnabled") === "on";

  const checkEnabled =
    formData.get("checkEnabled") === "on";

  const fwEnabled =
    formData.get("fwEnabled") === "on";

  const pmEnabled =
    formData.get("pmEnabled") === "on";

  const locations = [];

  if (fwEnabled) {
    const capacity = Number(formData.get("fwCapacity"));
    const price = Number(formData.get("fwPrice"));

    if (!capacity || capacity < 1) {
      return {
        error: "Please enter a valid Fort Washington capacity.",
      };
    }

    if (Number.isNaN(price) || price < 0) {
      return {
        error: "Please enter a valid Fort Washington price.",
      };
    }

    locations.push({
      studioCode: "FW",
      name: "Fort Washington",
      capacity,
      price,
    });
  }

  if (pmEnabled) {
    const capacity = Number(formData.get("pmCapacity"));
    const price = Number(formData.get("pmPrice"));

    if (!capacity || capacity < 1) {
      return {
        error: "Please enter a valid Plymouth Meeting capacity.",
      };
    }

    if (Number.isNaN(price) || price < 0) {
      return {
        error: "Please enter a valid Plymouth Meeting price.",
      };
    }

    locations.push({
      studioCode: "PM",
      name: "Plymouth Meeting",
      capacity,
      price,
    });
  }

  if (!name) {
    return {
      error: "Event name is required.",
    };
  }

  if (locations.length === 0) {
    return {
      error: "Please select at least one studio location.",
    };
  }

  if (!creditCardEnabled && !checkEnabled) {
    return {
      error: "Please select at least one payment method.",
    };
  }

  const event = await createEvent({
    name,
    description,
    date,
    creditCardEnabled,
    checkEnabled,
    locations,
  });

  return redirect(`/app/events/${event.id}`);
};

export default function NewEventPage() {
  const actionData = useActionData();
  const navigation = useNavigation();

  const isSubmitting =
    navigation.state === "submitting";

  return (
    <s-page heading="Add Event">
      <s-section>
        <Form method="post">
          {actionData?.error && (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: "20px",
                border: "1px solid #d82c0d",
                borderRadius: "8px",
              }}
            >
              {actionData.error}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gap: "24px",
              maxWidth: "700px",
            }}
          >
            <div>
              <label htmlFor="name">
                <strong>Event Name</strong>
              </label>

              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="IDA Halloween Party"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px",
                  marginTop: "6px",
                }}
              />
            </div>

            <div>
              <label htmlFor="description">
                <strong>Description</strong>
              </label>

              <textarea
                id="description"
                name="description"
                rows="4"
                placeholder="Halloween party details..."
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px",
                  marginTop: "6px",
                }}
              />
            </div>

            <div>
              <label htmlFor="date">
                <strong>Date &amp; Time</strong>
              </label>

              <input
                id="date"
                name="date"
                type="datetime-local"
                required
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px",
                  marginTop: "6px",
                }}
              />
            </div>

            <div>
              <strong>Studio Locations</strong>

              <p
                style={{
                  marginTop: "6px",
                  color: "#666",
                }}
              >
                Select the locations offering this event and set the
                capacity and price for each.
              </p>
            </div>

            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "18px",
              }}
            >
              <label>
                <input
                  type="checkbox"
                  name="fwEnabled"
                />{" "}
                <strong>Fort Washington</strong>
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginTop: "16px",
                }}
              >
                <div>
                  <label htmlFor="fwCapacity">
                    Capacity
                  </label>

                  <input
                    id="fwCapacity"
                    name="fwCapacity"
                    type="number"
                    min="1"
                    placeholder="75"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px",
                      marginTop: "6px",
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="fwPrice">
                    Price Per Spot
                  </label>

                  <input
                    id="fwPrice"
                    name="fwPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="25.00"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px",
                      marginTop: "6px",
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "18px",
              }}
            >
              <label>
                <input
                  type="checkbox"
                  name="pmEnabled"
                />{" "}
                <strong>Plymouth Meeting</strong>
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginTop: "16px",
                }}
              >
                <div>
                  <label htmlFor="pmCapacity">
                    Capacity
                  </label>

                  <input
                    id="pmCapacity"
                    name="pmCapacity"
                    type="number"
                    min="1"
                    placeholder="60"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px",
                      marginTop: "6px",
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="pmPrice">
                    Price Per Spot
                  </label>

                  <input
                    id="pmPrice"
                    name="pmPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="25.00"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px",
                      marginTop: "6px",
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <strong>Payment Methods</strong>

              <label
                style={{
                  display: "block",
                  marginTop: "10px",
                }}
              >
                <input
                  type="checkbox"
                  name="creditCardEnabled"
                  defaultChecked
                />{" "}
                Credit Card
              </label>

              <label
                style={{
                  display: "block",
                  marginTop: "8px",
                }}
              >
                <input
                  type="checkbox"
                  name="checkEnabled"
                  defaultChecked
                />{" "}
                Check
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 18px",
                  cursor:
                    isSubmitting
                      ? "default"
                      : "pointer",
                }}
              >
                {isSubmitting
                  ? "Creating..."
                  : "Create Event"}
              </button>

              <s-link href="/app/events">
                Cancel
              </s-link>
            </div>
          </div>
        </Form>
      </s-section>
    </s-page>
  );
}