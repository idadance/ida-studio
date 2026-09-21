import {
  Link,
  useLoaderData,
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
            registrations.map(
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
                      {registration.entryType} ·{" "}
                      {registration.teacher
                        ?.firstName ??
                        "No Preference"}{" "}
                      ·{" "}
                      {registration.genre
                        ?.name ??
                        "No Genre"}
                    </s-paragraph>

                    <s-paragraph>
                      Grade{" "}
                      {registration.grade} ·{" "}
                      {registration.studioCode}
                    </s-paragraph>

                    <Link
                      to={`/app/rehearsals/schedule/${registration.id}`}
                    >
                      View Scheduling Options
                    </Link>
                  </s-stack>
                </s-box>
              ),
            )
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}