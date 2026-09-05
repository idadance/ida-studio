import { Form, redirect } from "react-router";

import TeacherForm from "../components/TeacherForm";

import { authenticate } from "../shopify.server";
import { createTeacher } from "../services/teacher.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();

  await createTeacher({
  firstName: formData.get("firstName"),
  lastName: formData.get("lastName"),
  maxSoloDuets: Number(formData.get("maxSoloDuets")),
  availabilitySheetUrl: formData.get("availabilitySheetUrl"),
  active: formData.get("active") === "on",
  notes: formData.get("notes"),
});

  return redirect("/app/rehearsals/teachers");
};

export default function NewTeacherPage() {
  return (
    <s-page
      heading="Add Teacher"
      backAction={{
        content: "Teachers",
        url: "/app/rehearsals/teachers",
      }}
    >
      <Form method="post">

        <s-section>

          <TeacherForm />

        </s-section>

      </Form>
    </s-page>
  );
}