import {
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
  useRouteError,
} from "react-router";

import { authenticate } from "../shopify.server";
import { getTeachers } from "../services/teacher.server";

import {
  getSmartSchedulePreview,
} from "../services/smartSchedule.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

    const url = new URL(request.url);
  const teacherId = url.searchParams.get("teacherId");

    return {
    teachers: await getTeachers(),
    preview: teacherId
      ? await getSmartSchedulePreview(teacherId)
      : null,
  };
};

export default function SmartSchedulePage() {
const { teachers, preview } = useLoaderData();
const navigate = useNavigate();
const navigation = useNavigation();
const isLoading = navigation.state === "loading";
const [searchParams] = useSearchParams();

const selectedTeacherId =
  searchParams.get("teacherId") || "";
  return (
    <s-page heading="Smart Schedule">
      <s-section heading="Smart Schedule Preview">
        <div style={{ marginBottom: "20px" }}>
  <label
    htmlFor="smart-schedule-teacher"
    style={{
      display: "block",
      fontWeight: "bold",
      marginBottom: "8px",
    }}
  >
    Select Teacher
  </label>

  <select
    id="smart-schedule-teacher"
    value={selectedTeacherId}
onChange={(event) => {
  const teacherId = event.target.value;

  navigate(
    teacherId
      ? `/app/rehearsals/smart-schedule?teacherId=${encodeURIComponent(teacherId)}`
      : "/app/rehearsals/smart-schedule"
  );
}}
    style={{
      width: "100%",
      maxWidth: "400px",
      padding: "12px",
      border: "1px solid #ccc",
      borderRadius: "8px",
    }}
  >
    <option value="">Choose a teacher...</option>

    {teachers
      .filter((teacher) => teacher.active)
      .map((teacher) => (
        <option key={teacher.id} value={teacher.id}>
          {teacher.firstName} {teacher.lastName}
        </option>
      ))}
  </select>
</div>
{selectedTeacherId && (
  <div
    style={{
      padding: "12px",
      backgroundColor: "#f5f5f5",
      borderRadius: "8px",
      marginBottom: "20px",
    }}
  >
    <strong>Selected Teacher: </strong>
    {teachers.find(
      (teacher) => teacher.id === selectedTeacherId
    )?.firstName}{" "}
    {teachers.find(
      (teacher) => teacher.id === selectedTeacherId
    )?.lastName}
  </div>
)}
        <p>
          Select a rehearsal teacher to review proposed
          solo and duet rehearsal appointments.
        </p>

        <p style={{ color: "#666" }}>
          This is a read-only preview. No rehearsals
          will be scheduled, moved, or deleted.
        </p>
      </s-section>
      {isLoading && (
  <s-section heading="Calculating Schedule">
    <p>
      ⏳ Calculating rehearsal recommendations...
      Please wait.
    </p>
  </s-section>
)}
      {preview && !isLoading && (
  <s-section heading="Rehearsal Recommendations">
    <p>
      These are proposed rehearsals only.
      Nothing has been scheduled or changed.
    </p>

    <p>
      <strong>Dancer groups:</strong>{" "}
      {preview.groups.length}
    </p>

    {preview.groups.map((group, index) => (
      <div
        key={index}
        style={{
          padding: "16px 0",
          borderBottom: "1px solid #ddd",
        }}
      >
        <p>
          <strong>Group {index + 1}</strong>
        </p>

        <p>
          Proposed rehearsals:{" "}
          {group.proposedRehearsals.length}
        </p>

        <p>
          Still needed: {group.stillNeeded}
        </p>

        {group.proposedRehearsals.map((room, roomIndex) => (
          <p key={roomIndex}>
            {new Date(room.start).toLocaleString("en-US", {
              timeZone: "America/New_York",
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {" — "}
            {room.location}
            {" — "}
            {room.studioCalendar}
          </p>
        ))}
      </div>
    ))}
  </s-section>
)}
    </s-page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  console.error("Smart Schedule error:", error);

  return (
    <s-page heading="Smart Schedule">
      <s-section heading="Unable to Calculate Schedule">
        <p>
          Smart Schedule couldn't load the rehearsal
          recommendations.
        </p>

        <p>
          This may be a temporary connection issue
          with Apple Calendar or the scheduling service.
        </p>

        <p>
          No rehearsals have been scheduled or changed.
        </p>

        <a href="/app/rehearsals/smart-schedule">
          Return to Smart Schedule
        </a>
      </s-section>
    </s-page>
  );
}