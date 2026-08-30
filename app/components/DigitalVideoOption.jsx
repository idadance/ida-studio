export default function DigitalVideoOption({
  checked,
  price,
  onChange,
}) {
  return (
    <div
      style={{
        marginTop: 24,
        padding: 18,
        border: "1px solid #ddd",
        borderRadius: 12,
        background: "#fafafa",
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{
            marginTop: 4,
          }}
        />

        <div>
          <div
            style={{
              fontWeight: "bold",
              fontSize: 18,
            }}
          >
            Add Digital Video (+${price.toFixed(2)})
          </div>

          <div
            style={{
              color: "#666",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Your videos will automatically
            appear in your IDA Ticket folder
            after the show.
          </div>
        </div>
      </label>
    </div>
  );
}