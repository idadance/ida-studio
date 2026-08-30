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

const checkboxStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

export default function BoxOfficePanel({ show, settings }) {
  return (
    <div
      style={{
        marginTop: "18px",
        paddingTop: "18px",
        borderTop: "1px solid #ddd",
      }}
    >
      <Form method="post">
        <input
          type="hidden"
          name="_action"
          value="saveBoxOffice"
        />

        <input
          type="hidden"
          name="showId"
          value={show.id}
        />

        <div style={formPanelStyle}>
          <h5
            style={{
              margin: 0,
              fontSize: "18px",
            }}
          >
            🎟 Box Office
          </h5>

          <label>
            <div
              style={{
                marginBottom: "6px",
                fontWeight: "600",
              }}
            >
              Ticket price
            </div>

            <input
              type="number"
              name="ticketPrice"
              defaultValue={settings.ticketPrice}
              min="0"
              step="0.01"
              required
              style={fieldStyle}
            />
          </label>

          <label style={checkboxStyle}>
            <input
              type="checkbox"
              name="digitalVideo"
              defaultChecked={settings.digitalVideo}
            />

            Offer digital video
          </label>

          <label>
            <div
              style={{
                marginBottom: "6px",
                fontWeight: "600",
              }}
            >
              Digital video price
            </div>

            <input
              type="number"
              name="digitalVideoPrice"
              defaultValue={settings.digitalVideoPrice}
              min="0"
              step="0.01"
              required
              style={fieldStyle}
            />
          </label>

          <div>
            <div
              style={{
                marginBottom: "8px",
                fontWeight: "600",
              }}
            >
              Payment methods
            </div>

            <div
              style={{
                display: "grid",
                gap: "8px",
              }}
            >
              <label style={checkboxStyle}>
                <input
                  type="checkbox"
                  name="creditCardEnabled"
                  defaultChecked={settings.creditCardEnabled}
                />

                Credit card
              </label>

              <label style={checkboxStyle}>
                <input
                  type="checkbox"
                  name="checkEnabled"
                  defaultChecked={settings.checkEnabled}
                />

                Check
              </label>
            </div>
          </div>

          <label style={checkboxStyle}>
            <input
              type="checkbox"
              name="ticketLimitEnabled"
              defaultChecked={settings.ticketLimitEnabled}
            />

            Limit tickets per customer
          </label>

          <label>
            <div
              style={{
                marginBottom: "6px",
                fontWeight: "600",
              }}
            >
              Ticket limit
            </div>

            <input
              type="number"
              name="ticketLimit"
              defaultValue={settings.ticketLimit}
              min="1"
              required
              style={fieldStyle}
            />
          </label>

          <label style={checkboxStyle}>
            <input
              type="checkbox"
              name="salesOpen"
              defaultChecked={settings.salesOpen}
            />

            Open ticket sales
          </label>

          <div>
            <button type="submit">Save Box Office</button>
          </div>
        </div>
      </Form>
    </div>
  );
}