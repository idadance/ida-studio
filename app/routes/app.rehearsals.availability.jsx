import {
  Form,
  redirect,
  useLoaderData,
} from "react-router";

import {
  readAvailabilitySheet,
  parseAvailabilityRows,
} from "../services/googlesheets.server";

import {
  importTeacherAvailability,
} from "../services/teacherAvailability.server";

import { authenticate } from "../shopify.server";

import { getTeachers } from "../services/teacher.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    teachers: await getTeachers(),
  };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const teachers = await getTeachers();

  let importedTeachers = 0;
  let importedSlots = 0;

  for (const teacher of teachers) {
    if (!teacher.availabilitySheetUrl) {
      continue;
    }

    const rows = await readAvailabilitySheet(
      teacher.availabilitySheetUrl,
    );

    const availability =
      parseAvailabilityRows(rows);

    await importTeacherAvailability(
      teacher.id,
      availability,
    );

    importedTeachers++;
    importedSlots += availability.length;
  }

  console.log(
    `Imported ${importedTeachers} teachers (${importedSlots} slots).`,
  );

  return redirect(
    "/app/rehearsals/availability",
  );
};

export default function TeacherAvailabilityPage() {
  const { teachers } = useLoaderData();

  return (
    <s-page heading="Teacher Availability">

      <s-section>

        <Form method="post">
  <div style={{ marginBottom: "24px" }}>
    <button type="submit">
      Import All Teachers
    </button>
  </div>
</Form>

        {teachers.map((teacher) => (
          <div
            key={teacher.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "18px",
              marginBottom: "16px",
            }}
          >
            <h3>
              {teacher.firstName} {teacher.lastName}
            </h3>

            <div style={{ marginTop: "8px" }}>
              {teacher.availabilitySheetUrl ? (
                <>✅ Google Sheet Connected</>
              ) : (
                <>⚠️ No Google Sheet Connected</>
              )}
            </div>

            <div style={{ marginTop: "8px" }}>
              {teacher.genres.length > 0
                ? `🎭 ${teacher.genres
                    .map((g) => g.name)
                    .join(" • ")}`
                : "No genres assigned"}
            </div>

            <div style={{ marginTop: "16px" }}>
              {teacher.availabilitySheetUrl ? (
  <s-link
    href={`/app/rehearsals/import-teacher?id=${teacher.id}`}
  >
    Import
  </s-link>
) : (
                <s-link
                  href={`/app/rehearsals/edit-teacher?id=${teacher.id}`}
                >
                  Edit Teacher
                </s-link>
              )}
            </div>

          </div>
        ))}

      </s-section>

    </s-page>
  );
}