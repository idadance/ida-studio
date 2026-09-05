import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";
import { getTeachers } from "../services/teacher.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    teachers: await getTeachers(),
  };
};

export default function TeachersPage() {
  const { teachers } = useLoaderData();

  return (
    <s-page heading="Teachers">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "20px",
        }}
      >
        <s-link href="/app/rehearsals/new-teacher">
          + Add Teacher
        </s-link>
      </div>

      <s-section>
        {teachers.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
            }}
          >
            <div
              style={{
                fontSize: "60px",
                marginBottom: "20px",
              }}
            >
              👩‍🏫
            </div>

            <h2>No Teachers Yet</h2>

            <p
              style={{
                maxWidth: "450px",
                margin: "0 auto",
              }}
            >
              Add your rehearsal teachers before accepting Solo &amp; Duet
              entries.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <strong
                  style={{
                    fontSize: "18px",
                  }}
                >
                  {teacher.firstName} {teacher.lastName}
                </strong>

                <div
                  style={{
                    marginTop: "8px",
                  }}
                >
                  Maximum Solo/Duets: {teacher.maxSoloDuets}
                </div>

                <div
  style={{
    marginTop: "12px",
  }}
>
  <strong>Availability Sheet</strong>
</div>

<div
  style={{
    marginTop: "4px",
  }}
>
  {teacher.availabilitySheetUrl
    ? "✅ Connected"
    : "⚪ Not Connected"}
</div>

                <div
                  style={{
                    marginTop: "4px",
                  }}
                >
                  {teacher.active ? "✅ Active" : "⚪ Inactive"}
                </div>
                <div
  style={{
    marginTop: "16px",
  }}
>
  <s-link href={`/app/rehearsals/edit-teacher?id=${teacher.id}`}>
  ✏️ Edit
</s-link>
</div>
              </div>
            ))}
          </div>
        )}
      </s-section>

    </s-page>
  );
}