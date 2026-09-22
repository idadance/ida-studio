import {
  useLoaderData,
} from "react-router";

import {
  useState,
} from "react";

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

    const [selectedStudios, setSelectedStudios] =
    useState({});

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

                    <s-stack gap="small">
  <s-paragraph>
    Choose Studio:
  </s-paragraph>

  <select
    value={
      selectedStudios[
        `${slot.start}-${slot.location}`
      ] ?? ""
    }
    onChange={(event) => {
      const slotKey =
        `${slot.start}-${slot.location}`;

      setSelectedStudios(
        (current) => ({
          ...current,
          [slotKey]:
            event.target.value,
        }),
      );
    }}
  >
    <option value="">
      Select a studio
    </option>

    {slot.availableStudios.map(
      (studio) => (
        <option
          key={studio}
          value={studio}
        >
          {studio}
        </option>
      ),
    )}
  </select>
</s-stack>
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