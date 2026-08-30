import { Form } from "react-router";
import PerformanceForm from "./PerformanceForm";

export default function PerformanceCard({
  performance,
  studios,
  isExpanded,
  isEditing,
  onToggleShows,
  onToggleEdit,
  onCancelEdit,
  children,
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "16px",
      }}
    >
      {isEditing ? (
        <PerformanceForm
  mode="edit"
  performance={performance}
  studios={studios}
  onCancel={onCancelEdit}
/>
      ) : (
        <>
          <h3
            style={{
              marginTop: 0,
              marginBottom: "8px",
            }}
          >
            🎭 {performance.name}
          </h3>

          <p style={{ margin: "0 0 8px" }}>
            Status: {performance.status}
          </p>

          {performance.description && (
            <p style={{ margin: "0 0 8px" }}>
              {performance.description}
            </p>
          )}

          <p style={{ margin: "0 0 16px" }}>
            {performance.shows.length}{" "}
            {performance.shows.length === 1 ? "show" : "shows"}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <button type="button" onClick={onToggleShows}>
              {isExpanded ? "Hide Shows" : "Manage Shows"}
            </button>

            <button type="button" onClick={onToggleEdit}>
              Edit Performance
            </button>

            <Form
              method="post"
              onSubmit={(event) => {
                const confirmed = window.confirm(
                  `Delete "${performance.name}" and all of its shows, Box Office settings, and ticket orders? This cannot be undone.`,
                );

                if (!confirmed) {
                  event.preventDefault();
                }
              }}
            >
              <input
                type="hidden"
                name="_action"
                value="deletePerformance"
              />

              <input
                type="hidden"
                name="performanceId"
                value={performance.id}
              />

              <button type="submit">Delete Performance</button>
            </Form>
          </div>
        </>
      )}

      {!isEditing && isExpanded && children}
    </div>
  );
}