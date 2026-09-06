import { Form, redirect } from "react-router";

import { authenticate } from "../shopify.server";
import { createSeason } from "../services/season.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();

  await createSeason({
    name: formData.get("name"),
    active: formData.get("active") === "on",
  });

  return redirect("/app/rehearsals/seasons");
};

export default function NewSeasonPage() {
  return (
    <s-page
      heading="Add Season"
      backAction={{
        content: "Seasons",
        url: "/app/rehearsals/seasons",
      }}
    >
      <Form method="post">
        <s-section>

          <s-text-field
            label="Season Name"
            name="name"
            required
          />

          <br />

          <s-checkbox
            label="Make this the active season"
            name="active"
          />

          <br />

          <button type="submit">
            Save Season
          </button>

        </s-section>
      </Form>
    </s-page>
  );
}