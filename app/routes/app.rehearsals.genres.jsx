import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export default function GenresPage() {
  return (
    <s-page heading="Genres">
      <s-section>

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
            🎭
          </div>

          <h2>No Genres Yet</h2>

          <p
            style={{
              maxWidth: "450px",
              margin: "0 auto 24px",
            }}
          >
            Create the genres available for Solo &amp; Duet rehearsals.
          </p>

          <s-link href="/app/rehearsals/genres/new">
            + Add Genre
          </s-link>

        </div>

      </s-section>
    </s-page>
  );
}