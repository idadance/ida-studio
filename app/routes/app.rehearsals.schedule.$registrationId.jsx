import {
  useLoaderData,
} from "react-router";

import {
  getRegistrationById,
} from "../services/registration.server.js";

import {
  getRehearsalCandidateSlots,
} from "../services/rehearsalScheduling.server.js";

export async function loader({
  params,
}) {
  const registration =
    await getRegistrationById(
      params.registrationId,
    );

  if (!registration) {
    throw new Response(
      "Registration not found.",
      {
        status: 404,
      },
    );
  }

  const candidateSlots =
    await getRehearsalCandidateSlots(
      registration.id,
    );

  return {
    registration,

    candidateSlots:
      candidateSlots.map((slot) => ({
        date: slot.date,
        day: slot.day,
        timeSlot: slot.timeSlot,
        location: slot.location,
        start:
          slot.start.toISOString(),
        end:
          slot.end.toISOString(),
        availableStudios:
          slot.availableStudios,
      })),
  };
}

export default function RehearsalScheduleDetailPage() {
  const {
    registration,
    candidateSlots,
  } = useLoaderData();

  return (
    <s-page
      heading={`${registration.studentFirstName} ${registration.studentLastName}`}
    >
      <s-section>
        <s-stack gap="base">
          <s-heading>
            Scheduling Options
          </s-heading>

          <s-paragraph>
            {registration.entryType} ·{" "}
            {registration.teacher
              ?.firstName ??
              "No Preference"}{" "}
            ·{" "}
            {registration.genre?.name ??
              "No Genre"}
          </s-paragraph>

          <s-paragraph>
            Choose 3 rehearsals from the
            available options below.
          </s-paragraph>

          {candidateSlots.length === 0 ? (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <s-paragraph>
                No rehearsal times are
                currently available.
              </s-paragraph>
            </s-box>
          ) : (
            candidateSlots.map(
              (slot) => (
                <s-box
                  key={`${slot.start}-${slot.location}`}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                >
                  <s-stack gap="small">
                    <s-heading>
                      {slot.day},{" "}
                      {slot.date}
                    </s-heading>

                    <s-paragraph>
                      {slot.timeSlot} ·{" "}
                      {slot.location}
                    </s-paragraph>

                    <s-paragraph>
                      Available Studios:{" "}
                      {slot.availableStudios.join(
                        ", ",
                      )}
                    </s-paragraph>
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