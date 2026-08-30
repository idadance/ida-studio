import { Form } from "react-router";
import BoxOfficePanel from "./BoxOfficePanel";

export default function ShowCard({
  show,
  settings,
  ticketsSold,
  remainingSeats,
  soldOut,
  isEditing,
  isBoxOfficeOpen,
  onEdit,
  onBoxOffice,
  children,
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      {isEditing ? (
        children
      ) : (
        <>
          <h5
            style={{
              marginTop: 0,
              marginBottom: "8px",
              fontSize: "17px",
            }}
          >
            🎟 {show.name}
          </h5>

          <p
            style={{
              margin: "0 0 8px",
            }}
          >
            📅 {show.formattedDate}
          </p>

          <p
            style={{
              margin: "0 0 6px",
            }}
          >
            💺 Capacity: {show.capacity}
          </p>

          <p
            style={{
              margin: "0 0 6px",
            }}
          >
            🎟 Tickets Sold: {ticketsSold}
          </p>

          <p
            style={{
              margin: "0 0 10px",
              fontWeight: "600",
              color: soldOut
                ? "#c62828"
                : "#2e7d32",
            }}
          >
            {soldOut
              ? "🔴 SOLD OUT"
              : `🟢 Remaining: ${remainingSeats}`}
          </p>

          <p
            style={{
              margin: "0 0 14px",
            }}
          >
            {settings.salesOpen
              ? "🟢 Ticket sales open"
              : "⚪ Ticket sales closed"}
            {" · "}
            {settings.formattedPrice}
          </p>

          <p
            style={{
              margin: "0 0 14px",
              fontWeight: "700",
            }}
          >
            {show.checkInOpen
              ? "🟢 Check-in open"
              : "🔴 Check-in closed"}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <Form method="post">
              <input
                type="hidden"
                name="_action"
                value="toggleCheckIn"
              />

              <input
                type="hidden"
                name="showId"
                value={show.id}
              />

              <input
                type="hidden"
                name="checkInOpen"
                value={
                  show.checkInOpen
                    ? "false"
                    : "true"
                }
              />

              <button
                type="submit"
                style={{
                  fontWeight: "700",
                }}
              >
                {show.checkInOpen
                  ? "🔴 CLOSE CHECK-IN"
                  : "🟢 OPEN CHECK-IN"}
              </button>
            </Form>

            <button
              type="button"
              onClick={onEdit}
            >
              Edit Show
            </button>

            <button
              type="button"
              onClick={onBoxOffice}
            >
              {isBoxOfficeOpen
                ? "Close Box Office"
                : "🎟 Box Office"}
            </button>

            <Form
              method="post"
              onSubmit={(event) => {
                if (
                  !window.confirm(
                    `Delete "${show.name}"? This cannot be undone.`,
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input
                type="hidden"
                name="_action"
                value="deleteShow"
              />

              <input
                type="hidden"
                name="showId"
                value={show.id}
              />

              <button type="submit">
                Delete Show
              </button>
            </Form>
          </div>

          {isBoxOfficeOpen && (
            <BoxOfficePanel
              show={show}
              settings={settings}
            />
          )}
        </>
      )}
    </div>
  );
}