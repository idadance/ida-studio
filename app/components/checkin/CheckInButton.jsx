export default function CheckInButton({
  children,
  disabled = false,
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        width: "100%",
        padding: "26px",
        border: "none",
        borderRadius: 18,
        fontSize: 34,
        fontWeight: 700,
        cursor: disabled
          ? "default"
          : "pointer",
        background: disabled
          ? "#d1d5db"
          : "#16a34a",
        color: "white",
        transition: "all .2s",
      }}
    >
      {children}
    </button>
  );
}