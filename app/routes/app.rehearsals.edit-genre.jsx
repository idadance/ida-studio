import {
  Form,
  redirect,
  useLoaderData,
} from "react-router";

import {
  authenticate,
} from "../shopify.server";

import {
  getGenre,
  updateGenre,
} from "../services/genre.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  return {
    genre: await getGenre(id),
  };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  const formData = await request.formData();

  await updateGenre(id, {
    name: formData.get("name"),
  });

  return redirect("/app/rehearsals/genres");
};

export default function EditGenrePage() {
  const { genre } = useLoaderData();

  return (
    <s-page
      heading="Edit Genre"
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
            value={genre.name}
            required
          />

          <br />

          <button type="submit">
  Save Changes
</button>

        </s-section>
      </Form>
    </s-page>
  );
}