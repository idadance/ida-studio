import {
  Form,
  useLoaderData,
} from "react-router";

import { authenticate } from "../shopify.server";

import {
  getRegistrations,
  approveRegistration,
} from "../services/registration.server";

import {
  getTeachers,
} from "../services/teacher.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
  registrations: await getRegistrations(),
  teachers: await getTeachers(),
};
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();

  const intent = formData.get("intent");
  const registrationId =
    formData.get("registrationId");
    const teacherId =
  formData.get("teacherId");

  if (
    intent === "approve" &&
    registrationId
  ) {
    await approveRegistration(
      registrationId,
    );
  }

  if (
  intent === "change-teacher" &&
  registrationId &&
  teacherId
) {
  const {
    assignRegistrationTeacher,
  } = await import(
    "../services/registration.server"
  );

  await assignRegistrationTeacher(
    registrationId,
    teacherId,
  );
}

  return {
    success: true,
  };
};

export default function RegistrationsPage() {
  const {
  registrations,
  teachers,
} = useLoaderData();

  const groupedRegistrations = registrations.reduce(
    (groups, registration) => {
      const teacherName =
        registration.teacher?.firstName ??
        "No Preference";

      if (!groups[teacherName]) {
        groups[teacherName] = {
          teacher: registration.teacher,
          registrations: [],
        };
      }

      groups[teacherName].registrations.push(
        registration,
      );

      return groups;
    },
    {},
  );

  const teacherGroups = Object.entries(
    groupedRegistrations,
  ).sort(([nameA], [nameB]) => {
    if (nameA === "No Preference") return 1;
    if (nameB === "No Preference") return -1;

    return nameA.localeCompare(nameB);
  });

  return (
    <s-page heading="Solo & Duet Registrations">
      <s-section>
        {registrations.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
            }}
          >
            <h2>No registrations yet</h2>

            <p>
              Parent registrations will appear here.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                marginBottom: "24px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                }}
              >
                Teacher Requests
              </h2>

              <p
                style={{
                  marginTop: "6px",
                  color: "#666",
                }}
              >
                {registrations.length} total registrations
              </p>
            </div>

            {teacherGroups.map(
              ([
                teacherName,
                group,
              ]) => {
                const requested =
  group.registrations.reduce(
    (count, registration, index, registrations) => {
      if (registration.entryType !== "DUET") {
        return count + 1;
      }

      const dancerLastName =
        registration.studentLastName
          ?.trim()
          .toLowerCase();

      const partnerLastName =
        registration.partnerLastName
          ?.trim()
          .toLowerCase();

      const matchingPartnerIndex =
        registrations.findIndex((other) => {
          if (
            other.entryType !== "DUET" ||
            other.id === registration.id
          ) {
            return false;
          }

          const otherDancerLastName =
            other.studentLastName
              ?.trim()
              .toLowerCase();

          const otherPartnerLastName =
            other.partnerLastName
              ?.trim()
              .toLowerCase();

          return (
            otherDancerLastName === partnerLastName &&
            otherPartnerLastName === dancerLastName
          );
        });

      if (
        matchingPartnerIndex !== -1 &&
        matchingPartnerIndex < index
      ) {
        return count;
      }

      return count + 1;
    },
    0,
  );

                const max =
                  group.teacher?.maxSoloDuets;

                return (
                  <div
                    key={teacherName}
                    style={{
                      marginBottom: "32px",
                      border:
                        "1px solid #ddd",
                      borderRadius: "14px",
                      overflow: "hidden",
                      background: "white",
                    }}
                  >
                    <div
                      style={{
                        padding:
                          "16px 20px",
                        background:
                          "#f7f7f7",
                        borderBottom:
                          "1px solid #ddd",
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                        }}
                      >
                        {teacherName}
                      </h2>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "#666",
                        }}
                      >
                        {teacherName ===
                        "No Preference"
                          ? `${requested} registration${
                              requested === 1
                                ? ""
                                : "s"
                            }`
                          : `${requested} requested / ${max} max`}
                      </div>
                    </div>

                    <div
                      style={{
                        overflowX: "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse:
                            "collapse",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              textAlign:
                                "left",
                              background:
                                "#fafafa",
                            }}
                          >
                            <th
                              style={{
                                padding:
                                  "12px 16px",
                              }}
                            >
                              Dancer
                            </th>

                            <th
                              style={{
                                padding:
                                  "12px 16px",
                              }}
                            >
                              Grade
                            </th>

                            <th
                              style={{
                                padding:
                                  "12px 16px",
                              }}
                            >
                              Entry
                            </th>

                            <th
                              style={{
                                padding:
                                  "12px 16px",
                              }}
                            >
                              Genre
                            </th>

                            <th
                              style={{
                                padding:
                                  "12px 16px",
                              }}
                            >
                              Status
                            </th>

                            <th
                              style={{
                                padding:
                                  "12px 16px",
                              }}
                            >
                              Action
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {group.registrations
                            .slice()
                            .sort((a, b) => {
                              const lastName =
                                a.studentLastName.localeCompare(
                                  b.studentLastName,
                                );

                              if (
                                lastName !== 0
                              ) {
                                return lastName;
                              }

                              return a.studentFirstName.localeCompare(
                                b.studentFirstName,
                              );
                            })
                            .map(
                              (
                                registration,
                              ) => (
                                <tr
                                  key={
                                    registration.id
                                  }
                                  style={{
                                    borderTop:
                                      "1px solid #eee",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding:
                                        "14px 16px",
                                      fontWeight:
                                        "600",
                                    }}
                                  >
                                    {
                                      registration.studentFirstName
                                    }{" "}
                                    {
                                      registration.studentLastName
                                    }

                                    {registration.entryType ===
                                      "DUET" &&
                                      registration.partnerFirstName && (
                                        <div
                                          style={{
                                            marginTop:
                                              "3px",
                                            fontSize:
                                              "12px",
                                            fontWeight:
                                              "400",
                                            color:
                                              "#666",
                                          }}
                                        >
                                          with{" "}
                                          {
                                            registration.partnerFirstName
                                          }{" "}
                                          {
                                            registration.partnerLastName
                                          }
                                        </div>
                                      )}
                                  </td>

                                  <td
                                    style={{
                                      padding:
                                        "14px 16px",
                                    }}
                                  >
                                    {
                                      registration.grade
                                    }
                                  </td>

                                  <td
                                    style={{
                                      padding:
                                        "14px 16px",
                                    }}
                                  >
                                    {
                                      registration.entryType
                                    }
                                  </td>

                                  <td
                                    style={{
                                      padding:
                                        "14px 16px",
                                    }}
                                  >
                                    {registration
                                      .genre
                                      ?.name ??
                                      "—"}
                                  </td>

                                  <td
                                    style={{
                                      padding:
                                        "14px 16px",
                                    }}
                                  >
                                    {
                                      registration.status
                                    }
                                  </td>

                                  <td
  style={{
    padding: "14px 16px",
  }}
>
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: "170px",
    }}
  >
    {registration.status ===
    "REGISTERED" ? (
      <Form method="post">
        <input
          type="hidden"
          name="intent"
          value="approve"
        />

        <input
          type="hidden"
          name="registrationId"
          value={registration.id}
        />

        <s-button
          type="submit"
          variant="primary"
        >
          Approve
        </s-button>
      </Form>
    ) : (
      <span
        style={{
          color: "#666",
        }}
      >
        Approved
      </span>
    )}

    <Form method="post">
      <input
        type="hidden"
        name="intent"
        value="change-teacher"
      />

      <input
        type="hidden"
        name="registrationId"
        value={registration.id}
      />

      <select
        name="teacherId"
        defaultValue={
          registration.teacherId ?? ""
        }
        style={{
          width: "100%",
          padding: "7px 8px",
          border: "1px solid #bbb",
          borderRadius: "6px",
          background: "white",
        }}
      >
        <option value="" disabled>
          Select teacher
        </option>

        {teachers
          .filter(
            (teacher) =>
              teacher.active,
          )
          .map((teacher) => (
            <option
              key={teacher.id}
              value={teacher.id}
            >
              {teacher.firstName}
              {teacher.lastName
                ? ` ${teacher.lastName}`
                : ""}
            </option>
          ))}
      </select>

      <div
        style={{
          marginTop: "6px",
        }}
      >
        <s-button type="submit">
          Change Teacher
        </s-button>
      </div>
    </Form>
  </div>
</td>
                                </tr>
                              ),
                            )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              },
            )}
          </>
        )}
      </s-section>
    </s-page>
  );
}