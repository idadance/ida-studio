import { authenticate } from "../shopify.server";

import {
  useLoaderData,
  useSearchParams,
} from "react-router";

import {
  getProductionDashboard,
} from "../services/productionDashboard.server";

import CapacityCard from "../components/production/CapacityCard";
import WorkflowCard from "../components/production/WorkflowCard";
import RecentReservationsCard from "../components/production/RecentReservationsCard";


// ======================================
// LOADER
// ======================================

export const loader = async ({
  request,
}) => {
  await authenticate.admin(
    request,
  );

  const url =
    new URL(request.url);

  const performanceId =
    url.searchParams.get(
      "performance",
    );

  return await getProductionDashboard(
    performanceId,
  );
};


// ======================================
// PAGE
// ======================================

export default function Index() {
  const {
    performances,
    selectedPerformanceId,
    shows,
  } = useLoaderData();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const selectedPerformance =
    performances.find(
      (performance) =>
        performance.id ===
        selectedPerformanceId,
    );

  const selectedShows =
    shows.filter(
      (show) =>
        show.performanceId ===
        selectedPerformanceId,
    );


  function handlePerformanceChange(
    event,
  ) {
    const nextParams =
      new URLSearchParams(
        searchParams,
      );

    nextParams.set(
      "performance",
      event.target.value,
    );

    setSearchParams(
      nextParams,
    );
  }


  return (
    <s-page heading="IDA Production Center">

      {/* ============================= */}
      {/* PERFORMANCE SELECTOR */}
      {/* ============================= */}

      <s-section heading="Performance">
        {performances.length ===
        0 ? (
          <p>
            No published
            performances.
          </p>
        ) : (
          <select
            value={
              selectedPerformanceId ??
              ""
            }
            onChange={
              handlePerformanceChange
            }
            style={{
              width: "100%",
              maxWidth: "420px",
              padding: "12px",
              fontSize: "16px",
              borderRadius: "8px",
              border:
                "1px solid #ccc",
            }}
          >
            {performances.map(
              (performance) => (
                <option
                  key={
                    performance.id
                  }
                  value={
                    performance.id
                  }
                >
                  {
                    performance.name
                  }
                </option>
              ),
            )}
          </select>
        )}

        {selectedPerformance && (
          <p
            style={{
              marginTop: "10px",
              opacity: 0.7,
            }}
          >
            Showing production
            information for{" "}
            <strong>
              {
                selectedPerformance.name
              }
            </strong>
          </p>
        )}
      </s-section>


      {/* ============================= */}
      {/* PRODUCTION STATUS */}
      {/* ============================= */}

      <s-section heading="🎭 Production Status">
        <s-paragraph>
          Welcome to the IDA
          Production Center.
        </s-paragraph>

        <s-paragraph>
          Your recital operations
          dashboard will appear here.
        </s-paragraph>
      </s-section>


      {/* ============================= */}
      {/* DASHBOARD */}
      {/* ============================= */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "16px",
          marginTop: "16px",
        }}
      >
        <CapacityCard
          shows={selectedShows}
        />

        <WorkflowCard />

        <RecentReservationsCard />


        {/* =========================== */}
        {/* QUICK ACTIONS */}
        {/* =========================== */}

        <s-section heading="⚙️ Quick Actions">
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <s-button href="/app/performances">
              Manage Performances
            </s-button>

            <s-button href="/app/tickets">
              View Ticket Orders
            </s-button>

            <s-button href="/app/queue">
              Production Queue
            </s-button>
          </div>
        </s-section>
      </div>
    </s-page>
  );
}