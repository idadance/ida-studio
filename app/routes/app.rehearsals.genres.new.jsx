import { Form, redirect } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();

  await prisma.genre.create({
    data: {
      name: formData.get("name"),
    },
  });

  return redirect("/app/rehearsals/genres");
};

export default function NewGenrePage() {
  return (
    <s-page
      heading="Add Genre"
      backAction={{
        content: "Genres",
        url: "/app/rehearsals/genres",
      }}
    >
      <Form method="post">
        <s-section>

          <s-text-field
            label="Genre Name"
            name="name"
            required
          />

          <br />

          <button type="submit">
            Save Genre
          </button>

        </s-section>
      </Form>
    </s-page>
  );
}