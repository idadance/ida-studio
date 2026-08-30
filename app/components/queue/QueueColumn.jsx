export default function QueueColumn({
  title,
  count,
  children,
}) {
  return (
    <s-section heading={`${title} (${count})`}>
      <div
        style={{
          display: "grid",
          gap: "16px",
        }}
      >
        {children}
      </div>
    </s-section>
  );
}