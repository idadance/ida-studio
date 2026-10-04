import {
  Link,
  Outlet,
  useLoaderData,
  useNavigation,
  useParams,
} from "react-router";

import {
  getRegistrations,
} from "../services/registration.server.js";

export async function loader() {
  const registrations =
    await getRegistrations();

  const approved =
    registrations.filter(
      (registration) =>
        registration.status ===
        "APPROVED",
    );

  return {
    registrations: approved,
  };
}

export default function RehearsalSchedulePage() {
  const { registrations } =
    useLoaderData();

    const teacherGroups =
  registrations.reduce(
    (groups, registration) => {
      const teacherName =
        registration.teacher
          ? [
              registration.teacher
                .firstName,
              registration.teacher
                .lastName,
            ]
              .filter(Boolean)
              .join(" ")
          : "Needs Teacher Assignment";

      if (!groups[teacherName]) {
        groups[teacherName] = [];
      }

      groups[teacherName].push(
        registration,
      );

      return groups;
    },
    {},
  );

    const navigation = useNavigation();

const loadingRegistrationId =
  navigation.state === "loading"
    ? navigation.location?.pathname.split("/").pop()
    : null;

      const { registrationId } =
    useParams();

  if (registrationId) {
    return <Outlet />;
  }

  return (
    <s-page
      heading="Rehearsal Schedule"
    >
      <s-section>
        <s-stack gap="base">
          <s-heading>
            Ready to Schedule
          </s-heading>

          <s-paragraph>
            Approved Solo/Duet
            registrations appear here.
          </s-paragraph>

          {registrations.length === 0 ? (
  <s-paragraph>
    No approved registrations
    are ready to schedule.
  </s-paragraph>
) : (
  Object.entries(teacherGroups)
    .sort(([teacherA], [teacherB]) => {
      if (
        teacherA ===
        "Needs Teacher Assignment"
      ) {
        return 1;
      }

      if (
        teacherB ===
        "Needs Teacher Assignment"
      ) {
        return -1;
      }

      return teacherA.localeCompare(
        teacherB,
      );
    })
    .map(
      ([
        teacherName,
        teacherRegistrations,
      ]) => {
        const scheduledCount =
          teacherRegistrations.reduce(
            (total, registration) =>
              total +
              (registration
                .scheduledRehearsals
                ?.length ?? 0),
            0,
          );

        const totalRehearsals =
          teacherRegistrations.length *
          3;

        return (
          <s-box
            key={teacherName}
            padding="base"
            borderWidth="base"
            borderRadius="base"
          >
            <s-stack gap="base">
              <s-heading>
                {teacherName}
              </s-heading>

              <s-paragraph>
                {
                  teacherRegistrations.length
                }{" "}
                {teacherRegistrations.length ===
                1
                  ? "dancer"
                  : "dancers"}{" "}
                · {scheduledCount} of{" "}
                {totalRehearsals} rehearsals
                scheduled
              </s-paragraph>

              {teacherRegistrations.map(
                (registration) => (
                  <s-box
                    key={registration.id}
                    padding="base"
                    borderWidth="base"
                    borderRadius="base"
                  >
                    <s-stack gap="small">
                      <s-heading>
                        {
                          registration.studentFirstName
                        }{" "}
                        {
                          registration.studentLastName
                        }
                      </s-heading>

                      <s-paragraph>
                        {
                          registration.entryType
                        }{" "}
                        ·{" "}
                        {registration.genre
                          ?.name ??
                          "No Genre"}
                      </s-paragraph>

                      <s-paragraph>
                        {registration
                          .scheduledRehearsals
                          ?.length ?? 0}{" "}
                        of 3 rehearsals
                        scheduled
                      </s-paragraph>

                      <s-button
                        href={`/app/rehearsals/schedule/${registration.id}`}
                        loading={
                          loadingRegistrationId ===
                          registration.id
                        }
                        disabled={
                          loadingRegistrationId ===
                          registration.id
                        }
                      >
                        {loadingRegistrationId ===
                        registration.id
                          ? "Checking Availability..."
                          : "View Scheduling Options"}
                      </s-button>
                    </s-stack>
                  </s-box>
                ),
              )}
            </s-stack>
          </s-box>
        );
      },
    )
)}
        </s-stack>
      </s-section>
    </s-page>
  );
}