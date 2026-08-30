export default function QueueCard({
  title,
  subtitle,
  details = [],
  actionLabel,
  onAction,
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "16px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: "18px",
          }}
        >
          {title}
        </h3>

        {subtitle && (
          <p
            style={{
              margin: "4px 0 0",
              color: "#666",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {details.length > 0 && (
        <div
          style={{
            display: "grid",
            gap: "4px",
          }}
        >
          {details.map((detail, index) => (
            <div key={index}>{detail}</div>
          ))}
        </div>
      )}

      {actionLabel && (
        <div
          style={{
            marginTop: "8px",
          }}
        >
          <s-button onClick={onAction}>
            {actionLabel}
          </s-button>
        </div>
      )}
    </div>
  );
}