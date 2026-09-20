import {
  Form,
  useLoaderData,
} from "react-router";

import { authenticate } from "../shopify.server";

import {
  getRegistrations,
  approveRegistration,
} from "../services/registration.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    registrations: await getRegistrations(),
  };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();

  const intent = formData.get("intent");
  const registrationId =
    formData.get("registrationId");

  if (
    intent === "approve" &&
    registrationId
  ) {
    await approveRegistration(
      registrationId,
    );
  }

  return {
    success: true,
  };
};

export default function RegistrationsPage() {
  const { registrations } = useLoaderData();

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
            <h2>
              No registrations yet
            </h2>

            <p>
              Parent registrations will
              appear here.
            </p>
          </div>
        ) : (
          registrations.map((registration) => (
            <div
              key={registration.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "18px",
                marginBottom: "16px",
              }}
            >
              <h3>
                {registration.studentFirstName}{" "}
                {registration.studentLastName}
              </h3>

              <div>
                {registration.entryType}
              </div>

              <div>
  Grade: {registration.grade}
</div>

<div>
  Studio: {registration.studioCode}
</div>

{registration.entryType === "DUET" && (
  <div>
    Duet Partner:{" "}
    {registration.partnerFirstName}{" "}
    {registration.partnerLastName}
  </div>
)}

              <div>
  Teacher:{" "}
  {registration.teacher
    ? registration.teacher.firstName
    : "No Preference"}
</div>

              <div>
                Genre:{" "}
                {registration.genre.name}
              </div>

              <div
  style={{
    marginTop: "12px",
  }}
>
  <strong>
    Rehearsal Availability:
  </strong>

  {registration.availability.length === 0 ? (
    <div>
      No availability submitted
    </div>
  ) : (
    <ul
      style={{
        marginTop: "6px",
        paddingLeft: "20px",
      }}
    >
      {registration.availability.map(
        (slot) => (
          <li key={slot.id}>
            {slot.day}, {slot.date} —{" "}
            {slot.timeSlot} —{" "}
            {slot.preferredLocation}
          </li>
        ),
      )}
    </ul>
  )}
</div>

              <div>
                Payment:{" "}
                {registration.paymentStatus}
              </div>

              <div>
                Status:{" "}
                {registration.status}
              </div>

              {registration.status === "REGISTERED" && (
  <Form
    method="post"
    style={{
      marginTop: "16px",
    }}
  >
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
      Approve Registration
    </s-button>
  </Form>
)}

            </div>
          ))
        )}

      </s-section>

    </s-page>
  );
}