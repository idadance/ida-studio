import { Form } from "react-router";

const fieldStyle = {
  boxSizing: "border-box",
  width: "100%",
  padding: "10px",
  border: "1px solid #ccc",
  borderRadius: "6px",
};

const formPanelStyle = {
  display: "grid",
  gap: "14px",
  maxWidth: "540px",
  padding: "16px",
  background: "#f6f6f7",
  borderRadius: "8px",
};

export default function PerformanceForm({
  mode = "create",
  performance = null,
  studios = [],
  onCancel,
}) {
  const isEditing = mode === "edit";

  if (isEditing && !performance) {
    return null;
  }

  // ======================================
  // CREATE PERFORMANCE
  // ======================================

  if (!isEditing) {
    return (
      <Form method="post">
        <input
          type="hidden"
          name="_action"
          value="createPerformance"
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <input
            type="text"
            name="name"
            placeholder="Performance Name"
            required
            style={{
              ...fieldStyle,
              width: "300px",
              maxWidth: "100%",
            }}
          />

          <button type="submit">
            Create Performance
          </button>
        </div>
      </Form>
    );
  }

  // ======================================
  // EDIT PERFORMANCE
  // ======================================

  return (
    <Form method="post">
      <input
        type="hidden"
        name="_action"
        value="updatePerformance"
      />

      <input
        type="hidden"
        name="performanceId"
        value={performance.id}
      />

      <div style={formPanelStyle}>
        <h3
          style={{
            margin: 0,
            fontSize: "18px",
          }}
        >
          Edit Performance
        </h3>

        {/* PERFORMANCE NAME */}

        <label>
          <div
            style={{
              marginBottom: "6px",
              fontWeight: "600",
            }}
          >
            Performance name
          </div>

          <input
            type="text"
            name="name"
            defaultValue={performance.name}
            required
            style={fieldStyle}
          />
        </label>

        {/* DESCRIPTION */}

        <label>
          <div
            style={{
              marginBottom: "6px",
              fontWeight: "600",
            }}
          >
            Description
          </div>

          <textarea
            name="description"
            defaultValue={
              performance.description || ""
            }
            rows="4"
            placeholder="Optional description"
            style={{
              ...fieldStyle,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </label>

                {/* PERFORMANCE ROSTER GOOGLE SHEET TAB */}

        <div>
          <div
            style={{
              marginBottom: "6px",
              fontWeight: "600",
            }}
          >
            Performance Roster Sheet GID
          </div>

          <input
            type="text"
            name="rosterSheetGid"
            defaultValue={
              performance.rosterSheetGid || ""
            }
            placeholder="Example: 123456789"
            style={fieldStyle}
          />

          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginTop: "6px",
            }}
          >
            Enter the GID for this performance's
            roster tab in the Google Sheet.
          </div>
        </div>

        {/* DIGITAL PROGRAM */}

<div>
  <div
    style={{
      marginBottom: "6px",
      fontWeight: "600",
    }}
  >
    Digital Program URL
  </div>

  <input
    type="url"
    name="programUrl"
    defaultValue={
      performance.programUrl || ""
    }
    placeholder="https://..."
    style={fieldStyle}
  />

  <div
    style={{
      fontSize: "12px",
      color: "#666",
      marginTop: "6px",
    }}
  >
    After a ticket is checked in, the
    customer's digital ticket can open
    this performance's program.
  </div>
</div>

        {/* VIDEO VARIANT IDS */}

        <div>
          <div
            style={{
              marginBottom: "6px",
              fontWeight: "600",
            }}
          >
            Fort Washington Check Video Variant ID
          </div>

          <input
            type="text"
            name="fwCheckVideoVariantId"
            defaultValue={
              performance.fwCheckVideoVariantId ||
              ""
            }
            style={fieldStyle}
          />
        </div>

        <div>
          <div
            style={{
              marginBottom: "6px",
              fontWeight: "600",
            }}
          >
            Fort Washington Credit Video Variant ID
          </div>

          <input
            type="text"
            name="fwCreditVideoVariantId"
            defaultValue={
              performance.fwCreditVideoVariantId ||
              ""
            }
            style={fieldStyle}
          />
        </div>

        <div>
          <div
            style={{
              marginBottom: "6px",
              fontWeight: "600",
            }}
          >
            Plymouth Meeting Check Video Variant ID
          </div>

          <input
            type="text"
            name="pmCheckVideoVariantId"
            defaultValue={
              performance.pmCheckVideoVariantId ||
              ""
            }
            style={fieldStyle}
          />
        </div>

        <div>
          <div
            style={{
              marginBottom: "6px",
              fontWeight: "600",
            }}
          >
            Plymouth Meeting Credit Video Variant ID
          </div>

          <input
            type="text"
            name="pmCreditVideoVariantId"
            defaultValue={
              performance.pmCreditVideoVariantId ||
              ""
            }
            style={fieldStyle}
          />
        </div>

        {/* EXTRA TICKET REQUESTS */}

        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <input
              type="checkbox"
              name="extraTicketRequestsEnabled"
              defaultChecked={
                performance.extraTicketRequestsEnabled
              }
            />

            <strong>
              Allow Extra Ticket Requests
            </strong>
          </label>

          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginTop: "6px",
            }}
          >
            Allows families to request additional
            tickets after their initial order.
            Requests do not reserve seats and remain
            waiting until IDA distributes the
            remaining tickets.
          </div>
        </div>

        {/* COVER IMAGE */}

        <div>
          <div
            style={{
              marginBottom: "6px",
              fontWeight: "600",
            }}
          >
            Cover Image URL
          </div>

          <input
            type="text"
            name="coverImage"
            defaultValue={
              performance.coverImage || ""
            }
            placeholder="https://..."
            style={fieldStyle}
          />

          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginTop: "6px",
            }}
          >
            This image will appear on the customer
            website for this performance.
          </div>
        </div>

        {/* STATUS */}

        <label>
          <div
            style={{
              marginBottom: "6px",
              fontWeight: "600",
            }}
          >
            Status
          </div>

          <select
            name="status"
            defaultValue={performance.status}
            style={fieldStyle}
          >
            <option value="DRAFT">
              Draft
            </option>

            <option value="PUBLISHED">
              Published
            </option>

            <option value="CLOSED">
              Closed
            </option>

            <option value="ARCHIVED">
              Archived
            </option>
          </select>
        </label>

        {/* PARTICIPATING STUDIOS */}

        <div>
          <div
            style={{
              marginBottom: "8px",
              fontWeight: "600",
            }}
          >
            Participating Studios
          </div>

          <div
            style={{
              display: "grid",
              gap: "8px",
            }}
          >
            {studios.map((studio) => (
              <label
                key={studio.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <input
                  type="checkbox"
                  name="studios"
                  value={studio.id}
                  defaultChecked={
                    performance.studios.some(
                      (s) =>
                        s.id === studio.id,
                    )
                  }
                />

                {studio.name}
              </label>
            ))}
          </div>
        </div>

        {/* BUTTONS */}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <button type="submit">
            Save Performance
          </button>

          <button
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </Form>
  );
}