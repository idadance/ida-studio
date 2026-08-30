import { useLoaderData } from "react-router";

export default function RecentReservationsCard() {
  const { recentReservations } = useLoaderData();

  return (
    <s-section heading="🎟 Recent Reservations">
      {recentReservations.length === 0 ? (
        <s-paragraph>No reservations yet.</s-paragraph>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "12px",
          }}
        >
          {recentReservations.map((reservation) => (
            <div
              key={reservation.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <strong>{reservation.customerName}</strong>

              <div>{reservation.performance}</div>

              <div>{reservation.shows}</div>

              <div>
                🎟 {reservation.tickets} Tickets
              </div>
            </div>
          ))}
        </div>
      )}
    </s-section>
  );
}