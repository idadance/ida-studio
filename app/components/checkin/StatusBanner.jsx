export default function StatusBanner({
  status,
}) {
  const config = {
    valid: {
      emoji: "✅",
      title: "VALID TICKET",
      color: "#16a34a",
      background: "#ecfdf5",
    },

    partial: {
      emoji: "⚠️",
      title: "PARTIALLY USED",
      color: "#d97706",
      background: "#fffbeb",
    },

    used: {
      emoji: "🚫",
      title: "DO NOT ADMIT",
      color: "#dc2626",
      background: "#fef2f2",
    },
  };

  const current = config[status];

  return (
    <div
      style={{
        background: current.background,
        borderRadius: 20,
        padding: 32,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 70,
        }}
      >
        {current.emoji}
      </div>

      <h1
        style={{
          color: current.color,
          fontSize: 42,
          margin: "16px 0 0",
        }}
      >
        {current.title}
      </h1>
    </div>
  );
}