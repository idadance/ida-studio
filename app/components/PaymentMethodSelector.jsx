export default function PaymentMethodSelector({
  paymentMethod,
  onChange,
}) {
  return (
    <div
      style={{
        marginTop: 24,
        padding: 20,
        border: "1px solid #ddd",
        borderRadius: 12,
        background: "#fafafa",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Payment Method
      </h3>

      <label
        style={{
          display: "block",
          padding: "12px 0",
          cursor: "pointer",
        }}
      >
        <input
          type="radio"
          name="paymentMethod"
          value="credit"
          checked={paymentMethod === "credit"}
          onChange={() => onChange("credit")}
        />{" "}
        <strong>Credit Card</strong>

        <div
          style={{
            color: "#666",
            marginLeft: 24,
            marginTop: 4,
          }}
        >
          Pay securely online today.
        </div>
      </label>

      <hr />

      <label
        style={{
          display: "block",
          padding: "12px 0",
          cursor: "pointer",
        }}
      >
        <input
          type="radio"
          name="paymentMethod"
          value="check"
          checked={paymentMethod === "check"}
          onChange={() => onChange("check")}
        />{" "}
        <strong>Pay by Check</strong>

        <div
          style={{
            color: "#666",
            marginLeft: 24,
            marginTop: 4,
          }}
        >
          Reserve your tickets today and pay
          the studio by check later.
        </div>
      </label>
    </div>
  );
}