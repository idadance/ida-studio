import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";

import { getTeachers } from "../services/teacher.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    teachers: await getTeachers(),
  };
};

export default function TeacherAvailabilityPage() {
  const { teachers } = useLoaderData();

  return (
    <s-page heading="Teacher Availability">

      <s-section>

        <div style={{ marginBottom: "24px" }}>
          <button>
            Import All Teachers
          </button>
        </div>

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
                <button>
                  Import
                </button>
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