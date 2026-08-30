export default function CapacityCard({
  shows,
}) {

  const getStatus = (remaining) => {
    if (remaining <= 0)
      return {
        color: "#d82c0d",
        label: "SOLD OUT",
      };

    if (remaining <= 5)
      return {
        color: "#d82c0d",
        label: `${remaining} Seats Remaining`,
      };

    if (remaining <= 10)
      return {
        color: "#ff9800",
        label: `${remaining} Seats Remaining`,
      };

    if (remaining <= 20)
      return {
        color: "#f5a623",
        label: `${remaining} Seats Remaining`,
      };

    return {
      color: "#008060",
      label: `${remaining} Seats Remaining`,
    };
  };

  return (
    <s-section heading="🚨 Shows Needing Attention">
      <div
        style={{
          display: "grid",
          gap: "16px",
        }}
      >
        {shows.length === 0 ? (
          <s-paragraph>No published shows found.</s-paragraph>
        ) : (
          shows.map((show) => {
            const status = getStatus(show.remainingSeats);

            return (
              <div
                key={show.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                    marginBottom: "10px",
                  }}
                >
                  {show.name}
                </h3>

                <div
                  style={{
                    fontSize: "34px",
                    fontWeight: 700,
                    color: status.color,
                    lineHeight: 1,
                  }}
                >
                  {show.remainingSeats}
                </div>

                <div
                  style={{
                    marginBottom: "16px",
                    color: status.color,
                    fontWeight: 600,
                  }}
                >
                  {status.label}
                </div>

                <div
                  style={{
                    height: "12px",
                    background: "#ececec",
                    borderRadius: "999px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${show.percentFull}%`,
                      height: "100%",
                      background: status.color,
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "10px",
                    fontSize: "14px",
                    color: "#666",
                  }}
                >
                  <span>
                    {show.ticketsSold} Sold
                  </span>

                  <span>
                    Capacity {show.capacity}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </s-section>
  );
}