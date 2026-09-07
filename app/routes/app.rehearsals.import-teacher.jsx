import {
  Form,
  redirect,
  useLoaderData,
} from "react-router";

import { authenticate } from "../shopify.server";

import { getTeacher } from "../services/teacher.server";

import {
  readAvailabilitySheet,
  parseAvailabilityRows,
} from "../services/googlesheets.server";

import {
  importTeacherAvailability,
} from "../services/teacherAvailability.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  return {
    teacher: await getTeacher(id),
  };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  const teacher = await getTeacher(id);

  if (!teacher.availabilitySheetUrl) {
    throw new Error("Teacher does not have a Google Sheet.");
  }

const rows = await readAvailabilitySheet(
  teacher.availabilitySheetUrl,
);

const availability =
  parseAvailabilityRows(rows);

const imported =
  await importTeacherAvailability(
    teacher.id,
    availability,
  );

console.log(
  `Imported ${imported} availability slots.`,
);

  return redirect(
    `/app/rehearsals/import-teacher?id=${id}`,
  );
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
      <Form method="post">
        <s-section>

          <p>Google Sheet</p>

          <p>
            {teacher.availabilitySheetUrl
              ? "✅ Connected"
              : "❌ Not Connected"}
          </p>

          <br />

          <button type="submit">
            Read Google Sheet
          </button>

        </s-section>
      </Form>
    </s-page>
  );
}