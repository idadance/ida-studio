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
          <h2>Entries</h2>

          <p>
            Parents submit solo and duet entries.
          </p>

          <s-button disabled>
            Coming Soon
          </s-button>
        </s-card>

        <s-card>
          <h2>Schedule</h2>

          <p>
            Assign rehearsals and studios.
          </p>

          <s-button disabled>
            Coming Soon
          </s-button>
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