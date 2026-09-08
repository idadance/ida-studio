import { Form, redirect, useActionData, useNavigation } from "react-router";

import { authenticate } from "../shopify.server";
import { createEvent } from "../services/event.server";

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();

  const name = formData.get("name")?.trim();
  const description = formData.get("description")?.trim();
  const date = formData.get("date");
  const location = formData.get("location")?.trim();
  const capacity = Number(formData.get("capacity"));
  const price = Number(formData.get("price"));

  const creditCardEnabled = formData.get("creditCardEnabled") === "on";
  const checkEnabled = formData.get("checkEnabled") === "on";

  if (!name) {
    return {
      error: "Event name is required.",
    };
  }

  if (!capacity || capacity < 1) {
    return {
      error: "Capacity must be at least 1.",
    };
  }

  if (Number.isNaN(price) || price < 0) {
    return {
      error: "Please enter a valid price.",
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
    location,
    capacity,
    price,
    creditCardEnabled,
    checkEnabled,
  });

  return redirect(`/app/events/${event.id}`);
};

export default function NewEventPage() {
  const actionData = useActionData();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

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
              gap: "20px",
              maxWidth: "650px",
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
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px",
                  marginTop: "6px",
                }}
              />
            </div>

            <div>
              <label htmlFor="location">
                <strong>Location</strong>
              </label>

              <input
                id="location"
                name="location"
                type="text"
                placeholder="Fort Washington"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px",
                  marginTop: "6px",
                }}
              />
            </div>

            <div>
              <label htmlFor="capacity">
                <strong>Capacity</strong>
              </label>

              <input
                id="capacity"
                name="capacity"
                type="number"
                min="1"
                required
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
              <label htmlFor="price">
                <strong>Price Per Spot</strong>
              </label>

              <input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="25.00"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px",
                  marginTop: "6px",
                }}
              />
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
                marginTop: "10px",
              }}
            >
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 18px",
                  cursor: isSubmitting ? "default" : "pointer",
                }}
              >
                {isSubmitting ? "Creating..." : "Create Event"}
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