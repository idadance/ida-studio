import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";

import {
  getRegistrations,
} from "../services/registration.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    registrations: await getRegistrations(),
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
                Teacher:{" "}
                {registration.teacher.firstName}
              </div>

              <div>
                Genre:{" "}
                {registration.genre.name}
              </div>

              <div>
                Payment:{" "}
                {registration.paymentStatus}
              </div>

              <div>
                Status:{" "}
                {registration.status}
              </div>

            </div>
          ))
        )}

      </s-section>

    </s-page>
  );
}