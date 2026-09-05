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

  await prisma.teacher.create({
    data: {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      maxSoloDuets: Number(formData.get("maxSoloDuets")),
      active: formData.get("active") === "on",
      notes: formData.get("notes"),
    },
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

          <s-text-field
            label="First Name"
            name="firstName"
            required
          />

          <br />

          <s-text-field
            label="Last Name"
            name="lastName"
          />

          <br />

          <s-number-field
            label="Maximum Solo/Duets"
            name="maxSoloDuets"
            value="10"
            min="0"
          />

          <br />

          <s-checkbox
            name="active"
            checked
          >
            Active Teacher
          </s-checkbox>

          <br />

          <s-text-area
            label="Notes"
            name="notes"
          />

          <br />

          <button type="submit">
  Save Teacher
</button>

        </s-section>

      </Form>
    </s-page>
  );
}