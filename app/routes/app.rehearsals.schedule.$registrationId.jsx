import {
  Form,
  useLoaderData,
} from "react-router";

import {
  useState,
} from "react";

import {
  getRegistrationById,
} from "../services/registration.server.js";

import {
  createScheduledRehearsal,
  getRehearsalCandidateSlots,
} from "../services/rehearsalScheduling.server.js";

export async function action({
  request,
  params,
}) {
  const formData =
    await request.formData();

  const intent =
    formData.get("intent");

  if (intent !== "schedule") {
    return null;
  }

  const startTime =
    formData.get("startTime");

  const endTime =
    formData.get("endTime");

  const location =
    formData.get("location");

  const studioCalendar =
    formData.get("studioCalendar");

  if (
    !startTime ||
    !endTime ||
    !location ||
    !studioCalendar
  ) {
    throw new Error(
      "Missing rehearsal scheduling information.",
    );
  }

  await createScheduledRehearsal({
    registrationId:
      params.registrationId,
    startTime,
    endTime,
    location,
    studioCalendar,
  });

  return {
    success: true,
  };
}

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

          <s-heading>
  Scheduled Rehearsals —{" "}
  {registration.scheduledRehearsals.length} of 3
</s-heading>

{registration.scheduledRehearsals.length === 0 ? (
  <s-paragraph>
    No rehearsals scheduled yet.
  </s-paragraph>
) : (
  registration.scheduledRehearsals.map(
    (rehearsal) => (
      <s-box
        key={rehearsal.id}
        padding="base"
        borderWidth="base"
        borderRadius="base"
      >
        <s-stack gap="small">
          <s-paragraph>
            {new Date(
              rehearsal.startTime,
            ).toLocaleString(
              "en-US",
              {
                timeZone:
                  "America/New_York",
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              },
            )}
          </s-paragraph>

          <s-paragraph>
            {rehearsal.studioCalendar}
          </s-paragraph>
        </s-stack>
      </s-box>
    ),
  )
)}

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
  <Form method="post">
  <input
    type="hidden"
    name="intent"
    value="schedule"
  />

  <input
    type="hidden"
    name="startTime"
    value={slot.start}
  />

  <input
    type="hidden"
    name="endTime"
    value={slot.end}
  />

  <input
    type="hidden"
    name="location"
    value={slot.location}
  />

  <input
    type="hidden"
    name="studioCalendar"
    value={
      selectedStudios[
        `${slot.start}-${slot.location}`
      ] ?? ""
    }
  />

  <s-button
    type="submit"
    variant="primary"
    disabled={
      !selectedStudios[
        `${slot.start}-${slot.location}`
      ]
    }
  >
    Schedule Rehearsal
  </s-button>
</Form>
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