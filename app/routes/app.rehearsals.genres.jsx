import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    genres: await prisma.genre.findMany({
      orderBy: {
        name: "asc",
      },
    }),
  };
};

export default function GenresPage() {
    const { genres } = useLoaderData();
  return (
    <s-page heading="Genres">
      <s-section>

        {genres.length === 0 ? (
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

    <s-link href="/app/rehearsals/new-genre">
      + Add Genre
    </s-link>
  </div>
) : (
  <div
    style={{
      display: "grid",
      gap: "12px",
    }}
  >
    <s-link href="/app/rehearsals/new-genre">
      + Add Genre
    </s-link>

    {genres.map((genre) => (
      <div
        key={genre.id}
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
          {genre.name}
        </strong>
      </div>
    ))}
  </div>
)}

      </s-section>
    </s-page>
  );
}