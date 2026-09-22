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
  getRelatedDancerRehearsals,
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

    const relatedDancerRehearsals =
  await getRelatedDancerRehearsals(
    registration.id,
  );

  return {
  registration,

  relatedDancerRehearsals:
    relatedDancerRehearsals.map(
      (rehearsal) => ({
        id: rehearsal.id,

        startTime:
          rehearsal.startTime.toISOString(),

        endTime:
          rehearsal.endTime.toISOString(),

        studioCalendar:
          rehearsal.studioCalendar,

        entryType:
          rehearsal.registration.entryType,

        genre:
          rehearsal.registration.genre?.name ??
          null,

        teacher:
          rehearsal.teacher?.firstName ??
          null,
      }),
    ),

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
  relatedDancerRehearsals,
} = useLoaderData();

    const [selectedStudios, setSelectedStudios] =
    useState({});

    const getRelatedRehearsalMatch = (
  slot,
) => {
  const slotStart =
    new Date(slot.start);

  const slotEnd =
    new Date(slot.end);

  for (
    const rehearsal of
      relatedDancerRehearsals
  ) {
    const relatedStart =
      new Date(
        rehearsal.startTime,
      );

    const relatedEnd =
      new Date(
        rehearsal.endTime,
      );

    const beforeGap =
      slotStart.getTime() -
      relatedEnd.getTime();

    const afterGap =
      relatedStart.getTime() -
      slotEnd.getTime();

    if (
      beforeGap === 0 ||
      afterGap === 0
    ) {
      return {
        type: "BACK_TO_BACK",
        rehearsal,
      };
    }

    const sameDay =
      slotStart.toLocaleDateString(
        "en-US",
        {
          timeZone:
            "America/New_York",
        },
      ) ===
      relatedStart.toLocaleDateString(
        "en-US",
        {
          timeZone:
            "America/New_York",
        },
      );

    if (
      sameDay &&
      (
        (beforeGap > 0 &&
          beforeGap <=
            60 * 60 * 1000) ||
        (afterGap > 0 &&
          afterGap <=
            60 * 60 * 1000)
      )
    ) {
      return {
        type: "NEARBY",
        rehearsal,
      };
    }
  }

  return null;
};

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

{relatedDancerRehearsals.length > 0 && (
  <>
    <s-heading>
      Other Rehearsals for This Dancer
    </s-heading>

    <s-paragraph>
      This dancer has another Solo/Duet
      entry. These rehearsals may be
      helpful when choosing nearby times.
    </s-paragraph>

    {relatedDancerRehearsals.map(
      (rehearsal) => (
        <s-box
          key={rehearsal.id}
          padding="base"
          borderWidth="base"
          borderRadius="base"
        >
          <s-stack gap="small">
            <s-paragraph>
              {rehearsal.entryType}
              {rehearsal.genre
                ? ` · ${rehearsal.genre}`
                : ""}
            </s-paragraph>

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
              {rehearsal.teacher
                ? ` · ${rehearsal.teacher}`
                : ""}
            </s-paragraph>
          </s-stack>
        </s-box>
      ),
    )}
  </>
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
  (slot) => {
    const relatedMatch =
      getRelatedRehearsalMatch(
        slot,
      );

    return (
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

                    {relatedMatch && (
  <s-box
    padding="small"
    borderWidth="base"
    borderRadius="base"
  >
    <s-stack gap="small">
      <s-heading>
        {relatedMatch.type ===
        "BACK_TO_BACK"
          ? "Great Match — Back-to-Back"
          : "Good Match — Same Day"}
      </s-heading>

      <s-paragraph>
        This dancer already has a{" "}
        {
          relatedMatch.rehearsal
            .entryType
        }
        {relatedMatch.rehearsal.genre
          ? ` (${relatedMatch.rehearsal.genre})`
          : ""}{" "}
        rehearsal nearby.
      </s-paragraph>
    </s-stack>
  </s-box>
)}

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
    );
  },
)
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}