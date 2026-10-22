import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import {
  useState,
} from "react";

import {
  assignRegistrationTeacher,
  getRegistrationById,
} from "../services/registration.server.js";

import {
  createSoloDuetAvailabilityUpdateLink,
} from "../services/soloDuetRegistration.server.js";

import {
  getTeachers,
} from "../services/teacher.server.js";

import {
  cancelScheduledRehearsal,
  createScheduledRehearsal,
  getCoordinatingDancerRehearsals,
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

  if (intent === "assign-teacher") {
    const teacherId =
      formData.get("teacherId");

    if (!teacherId) {
      throw new Error(
        "Please select a teacher.",
      );
    }

    await assignRegistrationTeacher(
      params.registrationId,
      teacherId,
    );

    return {
      success: true,
    };
  }

  if (intent === "request-availability") {
  const link =
    await createSoloDuetAvailabilityUpdateLink({
      registrationId: params.registrationId,
    });

  return {
    success: true,
    availabilityUpdateToken: link.token,
  };
}

if (intent === "cancel-rehearsal") {
  const rehearsalId = formData.get("rehearsalId");

  if (
    typeof rehearsalId !== "string" ||
    !rehearsalId.trim()
  ) {
    throw new Error(
      "Missing rehearsal information for cancellation."
    );
  }

  try {
  await cancelScheduledRehearsal({
    registrationId: params.registrationId,
    rehearsalId,
  });

  return {
    success: true,
    message: "Rehearsal canceled successfully.",
  };
} catch (error) {
  console.error("Rehearsal cancellation failed:", error);

  return {
    success: false,
    cancellationError:
      error instanceof Error
        ? error.message
        : "The rehearsal could not be canceled. Please contact an administrator.",
  };
}
}

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

  const teachers =
  await getTeachers();

const needsTeacherAssignment =
  !registration.teacherId ||
  registration.teacher?.firstName === "No Preference";


let candidateSlots = [];
let availabilityError = null;

if (!needsTeacherAssignment) {
  try {
    candidateSlots =
      await getRehearsalCandidateSlots(
        registration.id,
      );
  } catch (error) {
    console.error(
      "Unable to load rehearsal availability:",
      error,
    );

    availabilityError =
      "Studio availability could not be verified with Apple Calendar. Existing rehearsals are still available to view, but new rehearsals cannot be scheduled until the connection is restored.";
  }
}


    const relatedDancerRehearsals =
  await getRelatedDancerRehearsals(
    registration.id,
  );

const coordinatingDancerRehearsals =
  await getCoordinatingDancerRehearsals(
    registration.id,
  );

return {
  registration,
availabilityError,

  teachers: teachers.filter(
    (teacher) => teacher.active,
  ),

  coordinatingDancerRehearsals:
    coordinatingDancerRehearsals.map(
      (rehearsal) => ({
        id: rehearsal.id,

        startTime:
          rehearsal.startTime.toISOString(),

        endTime:
          rehearsal.endTime.toISOString(),

        studioCalendar:
          rehearsal.studioCalendar,

        dancerName:
          `${rehearsal.registration.studentFirstName} ${rehearsal.registration.studentLastName}`,

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
availabilityError,
  teachers,
  candidateSlots,
  relatedDancerRehearsals,
  coordinatingDancerRehearsals,
} = useLoaderData();

const activeRehearsals =
  registration.scheduledRehearsals.filter(
    (rehearsal) =>
      rehearsal.cancellationStatus !== "CANCELED"
  );

const actionData = useActionData();

const cancellationError =
  actionData?.cancellationError;

const cancellationSuccess =
  actionData?.message;

const navigation = useNavigation();

const isAssigningTeacher =
  navigation.state === "submitting" &&
  navigation.formData?.get("intent") ===
    "assign-teacher";

    const isRequestingAvailability =
  navigation.state === "submitting" &&
  navigation.formData?.get("intent") ===
    "request-availability";

const isScheduling =
  navigation.state === "submitting" &&
  navigation.formData?.get("intent") ===
    "schedule";

    const isCanceling =
  navigation.state !== "idle" &&
  navigation.formData?.get("intent") ===
    "cancel-rehearsal";

const schedulingStartTime =
  isScheduling
    ? navigation.formData?.get("startTime")
    : null;

    const [selectedStudios, setSelectedStudios] =
    useState({});

    if (
  !registration.teacherId ||
  registration.teacher?.firstName === "No Preference"
) {
  return (
    <s-page
      heading={`${registration.studentFirstName} ${registration.studentLastName}`}
    >
      <s-section>
        <s-stack gap="base">
          <s-heading>
            Assign Teacher
          </s-heading>

          <s-paragraph>
            {registration.entryType} ·{" "}
            {registration.genre?.name ??
              "No Genre"}
          </s-paragraph>

          <s-paragraph>
            Assign a teacher before viewing
            rehearsal scheduling options.
          </s-paragraph>

          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="assign-teacher"
            />

            <s-stack gap="base">
              <select
                name="teacherId"
                defaultValue=""
                required
              >
                <option value="">
                  Select teacher
                </option>

                {teachers.map(
                  (teacher) => (
                    <option
                      key={teacher.id}
                      value={teacher.id}
                    >
                      {teacher.firstName}
                      {teacher.lastName
                        ? ` ${teacher.lastName}`
                        : ""}
                    </option>
                  ),
                )}
              </select>

              <s-button
                type="submit"
                variant="primary"
                loading={
                  isAssigningTeacher
                }
                disabled={
                  isAssigningTeacher
                }
              >
                {isAssigningTeacher
                  ? "Assigning..."
                  : "Assign Teacher"}
              </s-button>
            </s-stack>
          </Form>
        </s-stack>
      </s-section>
    </s-page>
  );
}

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

const getCoordinatingRehearsalMatch = (
  slot,
) => {
  const slotStart =
    new Date(slot.start);

  const slotEnd =
    new Date(slot.end);

  for (
    const rehearsal of
      coordinatingDancerRehearsals
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


{availabilityError && (
  <s-banner tone="warning">
    {availabilityError}
  </s-banner>
)}


          <s-paragraph>
            {registration.entryType} ·{" "}
            {registration.teacher
              ?.firstName ??
              "No Preference"}{" "}
            ·{" "}
            {registration.genre?.name ??
              "No Genre"}
          </s-paragraph>

          <Form method="post">
  <input
    type="hidden"
    name="intent"
    value="request-availability"
  />

  <s-button
    type="submit"
    disabled={isRequestingAvailability}
  >
    {isRequestingAvailability
      ? "Creating Link..."
      : "Request New Availability"}
  </s-button>
</Form>

{actionData?.availabilityUpdateToken && (
  <s-box
    padding="base"
    borderWidth="base"
    borderRadius="base"
  >
    <s-stack gap="small">
      <s-heading>
        New Availability Link
      </s-heading>

      <s-paragraph>
        Send this private link to the family:
      </s-paragraph>

      <s-paragraph>
        {`https://events.instituteofdanceartistry.com/rehearsal-availability?token=${actionData.availabilityUpdateToken}`}
      </s-paragraph>
    </s-stack>
  </s-box>
)}

          <s-paragraph>
            Choose 3 rehearsals from the
            available options below.
          </s-paragraph>

          {cancellationError && (
  <s-box
    padding="base"
    borderWidth="base"
    borderRadius="base"
  >
    <s-paragraph>
      ⚠️ {cancellationError}
    </s-paragraph>
  </s-box>
)}

{cancellationSuccess && (
  <s-box
    padding="base"
    borderWidth="base"
    borderRadius="base"
  >
    <s-paragraph>
      ✅ {cancellationSuccess}
    </s-paragraph>
  </s-box>
)}

          <s-heading>
  Scheduled Rehearsals —{" "}
  {activeRehearsals.length} of 3
</s-heading>

{activeRehearsals.length === 0 ? (
  <s-paragraph>
    No rehearsals scheduled yet.
  </s-paragraph>
) : (
  activeRehearsals.map(
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
          {rehearsal.cancellationStatus === "ACTIVE" && (
  <Form
    method="post"
    onSubmit={(event) => {
      const confirmed = window.confirm(
        "Are you sure you want to cancel this rehearsal? This will also remove its Apple Calendar event. If this is a duet, both dancers' rehearsal records will be canceled."
      );

      if (!confirmed) {
        event.preventDefault();
      }
    }}
  >
    <input
      type="hidden"
      name="intent"
      value="cancel-rehearsal"
    />
    <input
      type="hidden"
      name="rehearsalId"
      value={rehearsal.id}
    />
    <button
  type="submit"
  disabled={isCanceling}
>
  {isCanceling
    ? "Canceling..."
    : "Cancel Rehearsal"}
</button>
  </Form>
)}
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

{registration.coordinatingDancerName && (
  <>
    <s-heading>
      Coordinating Dancer
    </s-heading>

    <s-paragraph>
      Parent requested scheduling near{" "}
      {registration.coordinatingDancerName}.
    </s-paragraph>

    {coordinatingDancerRehearsals.length === 0 ? (
      <s-paragraph>
        No scheduled rehearsals found for this
        dancer yet.
      </s-paragraph>
    ) : (
      coordinatingDancerRehearsals.map(
        (rehearsal) => (
          <s-box
            key={rehearsal.id}
            padding="base"
            borderWidth="base"
            borderRadius="base"
          >
            <s-stack gap="small">
              <s-heading>
                {rehearsal.dancerName}
              </s-heading>

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
      )
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

const coordinatingMatch =
  getCoordinatingRehearsalMatch(
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

{coordinatingMatch && (
  <s-box
    padding="small"
    borderWidth="base"
    borderRadius="base"
  >
    <s-stack gap="small">
      <s-heading>
        {coordinatingMatch.type ===
        "BACK_TO_BACK"
          ? "Great Family Match — Back-to-Back"
          : "Good Family Match — Same Day"}
      </s-heading>

      <s-paragraph>
        {coordinatingMatch.rehearsal.dancerName}{" "}
        already has a rehearsal nearby.
      </s-paragraph>

      <s-paragraph>
        {new Date(
          coordinatingMatch.rehearsal.startTime,
        ).toLocaleString(
          "en-US",
          {
            timeZone:
              "America/New_York",
            weekday: "long",
            hour: "numeric",
            minute: "2-digit",
          },
        )}
        {" · "}
        {
          coordinatingMatch.rehearsal
            .studioCalendar
        }
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
  loading={
    isScheduling &&
    schedulingStartTime === slot.start
  }
  disabled={
    !selectedStudios[
      `${slot.start}-${slot.location}`
    ] ||
    isScheduling
  }
>
  {isScheduling &&
  schedulingStartTime === slot.start
    ? "Scheduling..."
    : "Schedule Rehearsal"}
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