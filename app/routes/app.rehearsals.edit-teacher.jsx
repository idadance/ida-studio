import {
  Form,
  redirect,
  useLoaderData,
} from "react-router";

import {
  authenticate,
} from "../shopify.server";

import {
  getTeacher,
  updateTeacher,
} from "../services/teacher.server";

import TeacherForm from "../components/TeacherForm";

export const loader = async ({
  request,
}) => {
  await authenticate.admin(request);

  const url = new URL(request.url);

  const id =
    url.searchParams.get("id");

  return {
    teacher: await getTeacher(id),
  };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  const formData = await request.formData();

  await updateTeacher(id, {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    maxSoloDuets: Number(formData.get("maxSoloDuets")),
    availabilitySheetUrl: formData.get("availabilitySheetUrl"),
    active: formData.get("active") === "on",
    notes: formData.get("notes"),
  });

  return redirect("/app/rehearsals/teachers");
};

export default function EditTeacherPage() {
  const { teacher } =
    useLoaderData();

  return (
    <s-page
  heading="Edit Teacher"
  backAction={{
    content: "Teachers",
    url: "/app/rehearsals/teachers",
  }}
>
  <Form method="post">
    <s-section>
      <TeacherForm
        teacher={teacher}
        submitLabel="Save Changes"
      />
    </s-section>
  </Form>
</s-page>
  );
}