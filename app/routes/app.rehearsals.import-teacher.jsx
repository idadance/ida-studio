import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";

import { getTeacher } from "../services/teacher.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);

  const id = url.searchParams.get("id");

  return {
    teacher: await getTeacher(id),
  };
};

export default function ImportTeacherPage() {
  const { teacher } = useLoaderData();

  return (
    <s-page
      heading={`Import ${teacher.firstName} ${teacher.lastName}`}
      backAction={{
        content: "Teacher Availability",
        url: "/app/rehearsals/availability",
      }}
    >
      <s-section>

        <p>
          Google Sheet
        </p>

        <p>
          {teacher.availabilitySheetUrl
            ? "✅ Connected"
            : "❌ Not Connected"}
        </p>

        <br />

        <button>
          Read Google Sheet
        </button>

      </s-section>
    </s-page>
  );
}