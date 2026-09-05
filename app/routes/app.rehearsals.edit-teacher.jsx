import {
  useLoaderData,
} from "react-router";

import {
  authenticate,
} from "../shopify.server";

import {
  getTeacher,
} from "../services/teacher.server";

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
    <s-page heading="Edit Teacher">
      <h2>
        {teacher.firstName}{" "}
        {teacher.lastName}
      </h2>

      <p>
        Maximum Solo/Duets:{" "}
        {teacher.maxSoloDuets}
      </p>

      <p>
        {teacher.active
          ? "✅ Active"
          : "⚪ Inactive"}
      </p>
    </s-page>
  );
}