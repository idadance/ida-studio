export default function TicketQuantitySelector({
  quantity,
  max,
  onChange,
}) {
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ marginBottom: 16 }}>
        Choose Tickets
      </h3>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <button
          type="button"
          onClick={() =>
            onChange(Math.max(1, quantity - 1))
          }
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            border: "none",
            background: "#E25186",
            color: "white",
            fontSize: 24,
            cursor: "pointer",
          }}
        >
          −
        </button>

        <div
          style={{
            minWidth: 40,
            textAlign: "center",
            fontSize: 28,
            fontWeight: "bold",
          }}
        >
          {quantity}
        </div>

        <button
          type="button"
          onClick={() =>
            onChange(Math.min(max, quantity + 1))
          }
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            border: "none",
            background: "#E25186",
            color: "white",
            fontSize: 24,
            cursor: "pointer",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}