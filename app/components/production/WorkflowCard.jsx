import { useLoaderData } from "react-router";

export default function WorkflowCard() {
  const { workflow } = useLoaderData();

  return (
    <s-section heading="📝 Production Workflow">
      <div
        style={{
          display: "grid",
          gap: "12px",
        }}
      >
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            ⏳ Waiting for Check
          </h3>

          <div
            style={{
              fontSize: "34px",
              fontWeight: 700,
            }}
          >
            {workflow.waitingForCheck}
          </div>

          <p>Reservations awaiting payment by check.</p>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            💵 Check Received
          </h3>

          <div
            style={{
              fontSize: "34px",
              fontWeight: 700,
            }}
          >
            {workflow.checkReceived}
          </div>

          <p>Checks received and ready to process.</p>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            🏦 Ready to Deposit
          </h3>

          <div
            style={{
              fontSize: "34px",
              fontWeight: 700,
            }}
          >
            {workflow.readyToDeposit}
          </div>

          <p>Checks received but not yet deposited.</p>
        </div>
      </div>
    </s-section>
  );
}