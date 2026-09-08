import { useLoaderData } from "react-router";

import { authenticate } from "../shopify.server";

import {
  getRegistrationCount,
} from "../services/registration.server";

import {
  getTeacherCount,
} from "../services/teacher.server";

import {
  getAvailabilityCount,
} from "../services/teacherAvailability.server";

import {
  getRehearsalEntryCount,
} from "../services/rehearsalEntry.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    registrations: await getRegistrationCount(),
    entries: await getRehearsalEntryCount(),
    teachers: await getTeacherCount(),
    availability: await getAvailabilityCount(),
  };
};

export default function RehearsalDashboardPage() {
  const {
    registrations,
    entries,
    teachers,
    availability,
  } = useLoaderData();

  return (
    <s-page heading="Rehearsal Dashboard">

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >

        <StatCard
          title="Registrations"
          value={registrations}
        />

        <StatCard
          title="Ready to Schedule"
          value={entries}
        />

        <StatCard
          title="Waiting for Partner"
          value={0}
        />

        <StatCard
          title="Waiting for Check"
          value={0}
        />

        <StatCard
          title="Teachers"
          value={teachers}
        />

        <StatCard
          title="Availability Slots"
          value={availability}
        />

      </div>

      <s-section>

        <h2>Quick Actions</h2>

        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            marginTop: "16px",
          }}
        >

          <s-link href="/app/rehearsals/availability">
            <button>
              Import Availability
            </button>
          </s-link>

          <s-link href="/app/rehearsals/teachers">
            <button>
              Teachers
            </button>
          </s-link>

          <s-link href="/app/rehearsals/registrations">
            <button>
              Registrations
            </button>
          </s-link>

          <s-link href="/app/rehearsals/schedule">
            <button>
              Schedule
            </button>
          </s-link>

        </div>

      </s-section>

    </s-page>
  );
}

function StatCard({
  title,
  value,
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "14px",
        padding: "22px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "36px",
          fontWeight: "700",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "8px",
          color: "#666",
        }}
      >
        {title}
      </div>
    </div>
  );
}