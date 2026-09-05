import {
  useLoaderData,
} from "react-router";

import {
  authenticate,
} from "../shopify.server";

import {
  getTeacher,
} from "../services/teacher.server";

import { Form } from "react-router";
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