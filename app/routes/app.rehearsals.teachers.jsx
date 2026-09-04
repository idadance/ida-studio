import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";

import {
  getTeachers,
} from "../services/teacher.server";

export const loader = async ({
  request,
}) => {
  await authenticate.admin(request);

  return {
    teachers: await getTeachers(),
  };
};

export default function TeachersPage() {
  const { teachers } =
    useLoaderData();

  return (
    <s-page heading="Teachers">
      <s-section>

        {teachers.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
            }}
          >
            <h2>No teachers yet</h2>

            <p>
              Add your first rehearsal
              teacher.
            </p>

            <s-button variant="primary">
              Add Teacher
            </s-button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            {teachers.map(
              (teacher) => (
                <div
                  key={teacher.id}
                  style={{
                    border:
                      "1px solid #ddd",
                    borderRadius:
                      "12px",
                    padding: "18px",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "18px",
                    }}
                  >
                    {teacher.firstName}
                    {" "}
                    {teacher.lastName}
                  </strong>

                  <div
                    style={{
                      marginTop: "8px",
                    }}
                  >
                    Maximum Solo/Duets:
                    {" "}
                    {teacher.maxSoloDuets}
                  </div>

                  <div
                    style={{
                      marginTop: "4px",
                    }}
                  >
                    {teacher.active
                      ? "✅ Active"
                      : "⚪ Inactive"}
                  </div>
                </div>
              ),
            )}
          </div>
        )}

      </s-section>
    </s-page>
  );
}