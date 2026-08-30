export default function OrderSummary({
  quantity,
  ticketPrice,
  includeVideo,
  videoPrice,
  paymentMethod,
}) {
  const checkTicketPrice = 15.00;
const creditTicketPrice = 15.39;

const checkVideoPrice = 15.00;
const creditVideoPrice = 15.39;

const activeTicketPrice =
  paymentMethod === "credit"
    ? creditTicketPrice
    : checkTicketPrice;

const activeVideoPrice =
  paymentMethod === "credit"
    ? creditVideoPrice
    : checkVideoPrice;

const ticketTotal = quantity * activeTicketPrice;
const videoTotal = includeVideo ? activeVideoPrice : 0;

const total = ticketTotal + videoTotal;

  return (
    <div
      style={{
        marginTop: 30,
        padding: 20,
        border: "1px solid #ddd",
        borderRadius: 12,
        background: "#fafafa",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Order Summary
      </h3>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span>Tickets ({quantity})</span>

        <strong>
          ${ticketTotal.toFixed(2)}
        </strong>
      </div>

      {includeVideo && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span>Digital Video</span>

          <strong>
            ${activeVideoPrice.toFixed(2)}
          </strong>
        </div>
      )}

      <hr />

      {paymentMethod === "credit" ? (
        <>

          <hr />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 22,
              fontWeight: "bold",
            }}
          >
            <span>Total</span>

            <span>
              ${total.toFixed(2)}
            </span>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span>Due Today</span>

            <strong>$0.00</strong>
          </div>

          <hr />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 22,
              fontWeight: "bold",
            }}
          >
            <span>Due by Check</span>

            <span>
  ${total.toFixed(2)}
</span>
          </div>
        </>
      )}
    </div>
  );
}