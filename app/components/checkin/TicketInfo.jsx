export default function TicketInfo({
  ticket,
}) {
  return (
    <div
      style={{
        textAlign: "center",
        marginTop: 40,
        marginBottom: 40,
      }}
    >
      <h2
        style={{
          fontSize: 42,
          margin: 0,
        }}
      >
        {ticket.customerName}
      </h2>

      <p
        style={{
          fontSize: 28,
          color: "#666",
          marginTop: 12,
        }}
      >
        {ticket.show.name}
      </p>

      <p
        style={{
          fontSize: 30,
          fontWeight: 600,
          marginTop: 24,
        }}
      >
        {ticket.checkedInCount} of {ticket.quantity} Used
      </p>
    </div>
  );
}