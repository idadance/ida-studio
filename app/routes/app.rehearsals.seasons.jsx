import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";

import { getSeasons } from "../services/season.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    seasons: await getSeasons(),
  };
};

export default function SeasonsPage() {
  const { seasons } = useLoaderData();

  return (
    <s-page heading="Solo & Duet Seasons">
      <s-section>

        <div style={{ marginBottom: "24px" }}>
          <s-link href="/app/rehearsals/new-season">
            + Add Season
          </s-link>
        </div>

        {seasons.length === 0 ? (
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

            <h2>No Seasons Yet</h2>

            <p>
              Create your first Solo &amp; Duet season.
            </p>
          </div>
        ) : (
          seasons.map((season) => (
            <div
              key={season.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "18px",
                marginBottom: "16px",
              }}
            >
              <strong
                style={{
                  fontSize: "18px",
                }}
              >
                {season.name}
              </strong>

              <div style={{ marginTop: "8px" }}>
                {season.active
                  ? "🟢 Active"
                  : "⚪ Inactive"}
              </div>

              <div style={{ marginTop: "12px" }}>
                <s-link
  href={`/app/rehearsals/dates?seasonId=${season.id}`}
>
  📅 Rehearsal Dates
</s-link>
              </div>
            </div>
          ))
        )}

      </s-section>
    </s-page>
  );
}