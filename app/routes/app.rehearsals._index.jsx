import { Link } from "react-router";

export default function RehearsalsPage() {
  return (
    <s-page heading="Rehearsals">
      <div
        style={{
          display: "grid",
          gap: "20px",
          marginTop: "20px",
        }}
      >
        <s-card>
  <h2>Seasons</h2>

  <p>
    Create and manage solo & duet rehearsal seasons.
  </p>

  <Link to="/app/rehearsals/seasons">
    <s-button variant="primary">
      Open Seasons
    </s-button>
  </Link>
</s-card>
        <s-card>
          <h2>Teachers</h2>

          <p>
            Manage rehearsal teachers and availability.
          </p>

          <Link to="/app/rehearsals/teachers">
            <s-button variant="primary">
              Open Teachers
            </s-button>
          </Link>
        </s-card>

        <s-card>
  <h2>Genres</h2>

  <p>
    Manage rehearsal genres.
  </p>

  <s-link href="/app/rehearsals/genres">
    <s-button variant="primary">
      Open Genres
    </s-button>
  </s-link>

</s-card>

<s-card>
  <h2>Teacher Availability</h2>

  <p>
    Import teacher availability from Google Sheets.
  </p>

  <Link to="/app/rehearsals/availability">
    <s-button variant="primary">
      Open Teacher Availability
    </s-button>
  </Link>
</s-card>

        <s-card>
  <h2>Registrations</h2>

  <p>
    Review and approve Solo & Duet registrations.
  </p>

  <Link to="/app/rehearsals/registrations">
    <s-button variant="primary">
      Open Registrations
    </s-button>
  </Link>
</s-card>

        <s-card>
  <h2>Schedule</h2>

  <p>
    Assign rehearsals and studios.
  </p>

  <Link to="/app/rehearsals/schedule">
    <s-button variant="primary">
      Open Schedule
    </s-button>
  </Link>
</s-card>

        <s-card>
          <h2>Reports</h2>

          <p>
            View rehearsal reports.
          </p>

          <s-button disabled>
            Coming Soon
          </s-button>
        </s-card>
      </div>
    </s-page>
  );
}