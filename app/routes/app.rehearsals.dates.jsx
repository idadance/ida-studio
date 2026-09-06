import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";

import { getRehearsalDates } from "../services/rehearsalDate.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);

  const seasonId = url.searchParams.get("seasonId");

  return {
    seasonId,
    rehearsalDates: await getRehearsalDates(seasonId),
  };
};

export default function RehearsalDatesPage() {
  const { rehearsalDates } = useLoaderData();

  return (
    <s-page heading="Rehearsal Dates">
      <s-section>

        <div style={{ marginBottom: "24px" }}>
          <s-link href="#">
            + Add Rehearsal Date
          </s-link>
        </div>

        {rehearsalDates.length === 0 ? (
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
              📅
            </div>

            <h2>No Rehearsal Dates Yet</h2>

            <p>
              Add your rehearsal weekends for this season.
            </p>
          </div>
        ) : (
          rehearsalDates.map((day) => (
            <div
              key={day.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "18px",
                marginBottom: "16px",
              }}
            >
              {new Date(day.date).toLocaleDateString()}
            </div>
          ))
        )}

      </s-section>
    </s-page>
  );
}