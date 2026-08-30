import {
  Form,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "react-router";

import {
  useEffect,
  useState,
} from "react";

import prisma from "../db.server";

import { authenticate } from "../shopify.server";
import {
  getTicketSales,
  getFamilyCoverage,
  getWaitlist,
} from "../services/productionDashboard.server";

function getAccountFromShop(shop) {
  if (
    shop ===
    "ida-dance-store.myshopify.com"
  ) {
    return "FW";
  }

  if (
    shop ===
    "ida-dance-store-pm.myshopify.com"
  ) {
    return "PM";
  }

  throw new Error(
    "This Shopify store is not recognized as an IDA studio.",
  );
}

export const loader = async ({
  request,
}) => {
    const { admin, session } =
  await authenticate.admin(
    request,
  );

  const account =
    getAccountFromShop(
      session.shop,
    );

  const url =
    new URL(request.url);

  const requestedPerformanceId =
    url.searchParams.get(
      "performance",
    );

    // ======================================
// TEMPORARY JAMIE CHECK DEBUG
// Read-only lookup of the ticket that
// failed during Receive Check.
// ======================================

const jamieDebugTicket =
  await prisma.ticketOrder.findUnique({
    where: {
      id: "cmsmdvyk7000bw91ubplyie78",
    },

    include: {
      show: true,
      reservation: true,
    },
  });

console.log(
  "🔎 JAMIE FAILED CHECK LOOKUP",
  jamieDebugTicket
    ? {
        ticketId:
          jamieDebugTicket.id,

        ticketStatus:
          jamieDebugTicket.status,

        showId:
          jamieDebugTicket.showId,

        showName:
          jamieDebugTicket.show?.name,

        quantity:
          jamieDebugTicket.quantity,

        checkNumber:
          jamieDebugTicket.checkNumber,

        checkReceivedAt:
          jamieDebugTicket.checkReceivedAt,

        reservationId:
          jamieDebugTicket.reservationId,

        reservationStatus:
          jamieDebugTicket.reservation?.status,

        customerName:
          jamieDebugTicket.reservation?.customerName,

        customerEmail:
          jamieDebugTicket.reservation?.customerEmail,

        shopifyOrderNumber:
          jamieDebugTicket.reservation?.shopifyOrderNumber,

        paymentMethod:
          jamieDebugTicket.reservation?.paymentMethod,
      }
    : "TICKET NOT FOUND",
);

  // ======================================
  // PUBLISHED PERFORMANCES
  // ======================================

  const performances =
    await prisma.performance.findMany({
      where: {
        status: "PUBLISHED",
      },

      select: {
        id: true,
        name: true,
        rosterSheetGid: true,
        createdAt: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  // ======================================
  // SELECTED PERFORMANCE
  //
  // Use the performance from the URL
  // when valid.
  //
  // Otherwise use the newest published
  // performance.
  // ======================================

  const selectedPerformanceId =
    requestedPerformanceId &&
    performances.some(
      (performance) =>
        performance.id ===
        requestedPerformanceId,
    )
      ? requestedPerformanceId
      : performances[0]?.id ??
        null;

  // ======================================
  // NO PUBLISHED PERFORMANCE
  // ======================================

  if (!selectedPerformanceId) {
    return {
      account,

      performances,

      selectedPerformanceId:
        null,

      sales: {
        totalReservations: 0,
        totalTickets: 0,
        shows: [],
        customers: [],
      },

      familyCoverage: {
        totalFamilies: 0,
        purchasedFamilies: 0,
        missingFamilies: 0,
        missingFW: 0,
        missingPM: 0,
        missingStudio: 0,
        families: [],
        purchased: [],
        missing: [],
        missingFWFamilies: [],
        missingPMFamilies: [],
        missingStudioFamilies: [],
      },

      waitlist: {
        totalFamilies: 0,
        totalTicketsRequested: 0,
        shows: [],
        entries: [],
      },
    };
  }

    // ======================================
  // PERFORMANCE-SPECIFIC DATA
  // ======================================

  const selectedPerformance =
    performances.find(
      (performance) =>
        performance.id ===
        selectedPerformanceId,
    );

  const emptyFamilyCoverage = {
    totalFamilies: 0,
    purchasedFamilies: 0,
    missingFamilies: 0,
    missingFW: 0,
    missingPM: 0,
    missingStudio: 0,
    families: [],
    purchased: [],
    missing: [],
    missingFWFamilies: [],
    missingPMFamilies: [],
    missingStudioFamilies: [],
  };

// ======================================
// EXPIRE OLD EXTRA TICKET OFFERS
//
// This runs whenever Ticket Sales opens.
// Expired unpaid offers are cancelled,
// their Shopify invoice is removed, and
// their held seats are released.
// ======================================

const {
  expireExtraTicketOffers,
} = await import(
  "../services/extraTicketRequests.server"
);

await expireExtraTicketOffers({
  admin,
  performanceId:
    selectedPerformanceId,
});

  const [
    sales,
    familyCoverage,
    waitlist,
  ] = await Promise.all([
    getTicketSales(
      selectedPerformanceId,
    ),

    selectedPerformance
      ?.rosterSheetGid
      ? getFamilyCoverage(
          selectedPerformanceId,
        )
      : Promise.resolve(
          emptyFamilyCoverage,
        ),

    getWaitlist(
      selectedPerformanceId,
    ),
  ]);

  return {
    account,

    performances,

    selectedPerformanceId,

    sales,

    familyCoverage,

    waitlist,
  };
};

export const action = async ({
  request,
}) => {
  const { admin, session } =
  await authenticate.admin(
    request,
  );

  const account =
    getAccountFromShop(
      session.shop,
    );

  const formData =
    await request.formData();

  const intent =
  formData.get("intent");
  if (
  intent ===
  "approve-extra-tickets"
) {
  const requestId =
    String(
      formData.get(
        "requestId",
      ) ?? "",
    ).trim();

  if (!requestId) {
    return {
      ok: false,
      intent:
        "approve-extra-tickets",
      error:
        "Extra Ticket Request was not found.",
    };
  }

  try {
    const {
      approveExtraTicketRequest,
    } = await import(
      "../services/extraTicketRequests.server"
    );

    const result =
      await approveExtraTicketRequest({
        requestId,
        account,
        admin,
      });

    return {
      ok: true,
      intent:
        "approve-extra-tickets",
      result,
    };
  } catch (error) {
    console.error(
      "APPROVE EXTRA TICKETS FAILED",
      error,
    );

    return {
      ok: false,
      intent:
        "approve-extra-tickets",
      error:
        error instanceof Error
          ? error.message
          : "The Extra Ticket Request could not be approved.",
    };
  }
}

// ======================================
// EDIT TICKET ORDER
// ======================================

if (intent === "edit-order") {
  const reservationId =
    String(
      formData.get(
        "reservationId",
      ) ?? "",
    ).trim();

  if (!reservationId) {
    return {
      ok: false,
      error:
        "Reservation was not found.",
    };
  }

  const quantities = {};

  for (
    const [key, value] of
    formData.entries()
  ) {
    if (
      !key.startsWith(
        "quantity:",
      )
    ) {
      continue;
    }

    const showId =
      key.slice(
        "quantity:".length,
      );

    const quantity =
      Number(value);

    if (
      !showId ||
      !Number.isInteger(
        quantity,
      ) ||
      quantity < 0
    ) {
      return {
        ok: false,
        error:
          "Ticket quantities must be whole numbers of zero or greater.",
      };
    }

    quantities[showId] =
      quantity;
  }

  try {
    const {
      updateTicketOrder,
    } = await import(
      "../services/ticketOrderEditor.server"
    );

    const result =
      await updateTicketOrder({
        reservationId,
        account,
        quantities,
      });

    return {
      ok: true,
      intent:
        "edit-order",
      result,
    };
  } catch (error) {
    console.error(
      "EDIT TICKET ORDER FAILED",
      error,
    );

    return {
      ok: false,
      intent:
        "edit-order",
      error:
        error instanceof Error
          ? error.message
          : "The ticket order could not be updated.",
    };
  }
}

// ======================================
// ADD WAITLIST
// ======================================

if (
  intent !==
  "add-waitlist"
) {
  return {
    ok: false,
    error:
      "Unknown action.",
  };
}

  const customerName =
    String(
      formData.get(
        "customerName",
      ) ?? "",
    ).trim();

  const customerEmail =
    String(
      formData.get(
        "customerEmail",
      ) ?? "",
    )
      .trim()
      .toLowerCase();

  const customerPhone =
    String(
      formData.get(
        "customerPhone",
      ) ?? "",
    ).trim();

  const showId =
    String(
      formData.get(
        "showId",
      ) ?? "",
    ).trim();

  const quantity =
    Number(
      formData.get(
        "quantity",
      ),
    );
    const requestedAtValue =
  String(
    formData.get(
      "requestedAt",
    ) ?? "",
  ).trim();

const requestedAt =
  requestedAtValue
    ? new Date(requestedAtValue)
    : new Date();

  if (
    !customerName ||
    !customerEmail ||
    !showId ||
    !Number.isInteger(
      quantity,
    ) ||
    quantity < 1
  ) {
    return {
      ok: false,
      error:
        "Please complete all required waiting list fields.",
    };
  }

  const show =
    await prisma.show.findUnique({
      where: {
        id: showId,
      },

      select: {
        id: true,
      },
    });

  if (!show) {
    return {
      ok: false,
      error:
        "That performance could not be found.",
    };
  }

  await prisma.waitlistEntry.create({
  data: {
    customerName,
    customerEmail,

    customerPhone:
      customerPhone ||
      null,

    account,
    quantity,
    showId,

    requestedAt,

    type:
  "EXTRA_TICKETS",

    status:
      "WAITING",
  },
});

  return {
    ok: true,
  };
};

export default function TicketSalesPage() {
  const navigate = useNavigate();

    const navigation =
    useNavigation();

    const [searchTerm, setSearchTerm] =
  useState("");

  const {
    account,
    performances,
    selectedPerformanceId,
    sales,
    familyCoverage,
    waitlist,
  } = useLoaderData();

  const normalizedSearch =
  searchTerm
    .trim()
    .toLowerCase();

const filteredCustomers =
  normalizedSearch
    ? sales.customers.filter(
        (customer) => {
          const searchableText = [
            customer.customerName,
            customer.customerEmail,
            customer.shopifyOrderNumber,
            customer.paymentMethod,
            customer.account,
            ...(customer.shows ?? []).map(
              (show) =>
                show.name,
            ),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            normalizedSearch,
          );
        },
      )
    : sales.customers;
const actionData =
  useActionData();
const [editingOrderId, setEditingOrderId] =
  useState(null);
  useEffect(() => {
  if (
    actionData?.ok &&
    actionData?.intent ===
      "edit-order"
  ) {
    setEditingOrderId(null);
  }
}, [actionData]);

  const currentStudioName =
    account === "FW"
      ? "Fort Washington"
      : "Plymouth Meeting";

  return (
    <s-page heading="Ticket Sales">
      <s-section>
        {actionData?.ok &&
  actionData?.intent ===
    "edit-order" && (
    <div
      style={{
        marginBottom: "18px",
        padding: "12px 16px",
        border: "1px solid #b7dfc5",
        borderRadius: "8px",
        background: "#f1faf4",
        fontWeight: "600",
      }}
    >
      ✓ Ticket order updated successfully.
    </div>
  )}
        <div
          style={{
            marginBottom: "22px",
          }}
        >
            <div
  style={{
    marginBottom: "20px",
  }}
>
  <label>
    <div
      style={{
        marginBottom: "6px",
        fontWeight: "600",
      }}
    >
      Performance
    </div>

    <select
      value={selectedPerformanceId ?? ""}
      onChange={(event) => {
  const performanceId =
    event.target.value;

  navigate(
    `?performance=${encodeURIComponent(
      performanceId,
    )}`,
  );
}}
      style={{
        width: "100%",
        maxWidth: "520px",
        padding: "10px",
        boxSizing: "border-box",
      }}
    >
      {performances.map((performance) => (
        <option
          key={performance.id}
          value={performance.id}
        >
          {performance.name}
        </option>
      ))}
    </select>
  </label>
</div>
          <h2
            style={{
              marginBottom: "6px",
            }}
          >
            Performance Overview
          </h2>

          <p
            style={{
              marginTop: 0,
            }}
          >
            Ticket totals below include
            Fort Washington and
            Plymouth Meeting combined.
          </p>
        </div>

        {sales.shows.length === 0 ? (
          <p>
            No ticket sales yet.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
              marginBottom: "32px",
            }}
          >
            {sales.shows.map(
              (show) => (
                <div
                  key={show.id}
                  style={{
                    border:
                      "1px solid #ddd",
                    borderRadius:
                      "12px",
                    padding: "18px",
                  }}
                >
                  <strong
                    style={{
                      fontSize:
                        "18px",
                    }}
                  >
                    {show.name}
                  </strong>

                  <div
                    style={{
                      marginTop:
                        "14px",
                    }}
                  >
                    <strong
                      style={{
                        fontSize:
                          "30px",
                      }}
                    >
                      {
                        show.ticketsSold
                      }
                    </strong>

                    <span
                      style={{
                        fontSize:
                          "18px",
                      }}
                    >
                      {" "}
                      /{" "}
                      {
                        show.capacity
                      }
                    </span>
                  </div>

                  <div>
                    tickets sold
                  </div>

                  <div
                    style={{
                      marginTop:
                        "8px",
                    }}
                  >
                    <strong>
                      {
                        show.remainingSeats
                      }
                    </strong>{" "}
                    seats remaining
                  </div>
                </div>
              ),
            )}
          </div>
        )}

                <div
          style={{
            borderTop: "1px solid #ddd",
            paddingTop: "24px",
            marginTop: "8px",
            marginBottom: "28px",
          }}
        >
            <div
  style={{
    borderTop: "1px solid #ddd",
    paddingTop: "24px",
    marginTop: "28px",
  }}
>
  <h2>
    Waiting List
  </h2>

  <p>
    Customers waiting for tickets
    across both studios.
  </p>
  <Form
  method="post"
  style={{
    border: "1px solid #ddd",
    borderRadius: "12px",
    padding: "18px",
    marginTop: "16px",
    marginBottom: "20px",
  }}
>
  <input
    type="hidden"
    name="intent"
    value="add-waitlist"
  />

  <h3
    style={{
      marginTop: 0,
      marginBottom: "16px",
    }}
  >
    Add to Waiting List
  </h3>

  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "12px",
    }}
  >
    <label>
      <div
        style={{
          marginBottom: "5px",
          fontWeight: "600",
        }}
      >
        Customer Name
      </div>

      <input
        type="text"
        name="customerName"
        required
        style={{
          width: "100%",
          padding: "10px",
          boxSizing: "border-box",
        }}
      />
    </label>

    <label>
      <div
        style={{
          marginBottom: "5px",
          fontWeight: "600",
        }}
      >
        Email
      </div>

      <input
        type="email"
        name="customerEmail"
        required
        style={{
          width: "100%",
          padding: "10px",
          boxSizing: "border-box",
        }}
      />
    </label>

    <label>
      <div
        style={{
          marginBottom: "5px",
          fontWeight: "600",
        }}
      >
        Phone
      </div>

      <input
        type="tel"
        name="customerPhone"
        style={{
          width: "100%",
          padding: "10px",
          boxSizing: "border-box",
        }}
      />
    </label>

    <label>
      <div
        style={{
          marginBottom: "5px",
          fontWeight: "600",
        }}
      >
        Show
      </div>

      <select
        name="showId"
        required
        style={{
          width: "100%",
          padding: "10px",
          boxSizing: "border-box",
        }}
      >
        <option value="">
          Select a show
        </option>

        {sales.shows.map(
          (show) => (
            <option
              key={show.id}
              value={show.id}
            >
              {show.name}
              {" — "}
              {show.remainingSeats === 0
                ? "SOLD OUT"
                : `${show.remainingSeats} seats remaining`}
            </option>
          ),
        )}
      </select>
    </label>

    <label>
      <div
        style={{
          marginBottom: "5px",
          fontWeight: "600",
        }}
      >
        Tickets Requested
      </div>

      <input
        type="number"
        name="quantity"
        min="1"
        step="1"
        required
        style={{
          width: "100%",
          padding: "10px",
          boxSizing: "border-box",
        }}
      />
    </label>
    <label>
  <div
    style={{
      marginBottom: "5px",
      fontWeight: "600",
    }}
  >
    Request Received
  </div>

  <input
    type="datetime-local"
    name="requestedAt"
    style={{
      width: "100%",
      padding: "10px",
      boxSizing: "border-box",
    }}
  />

  <div
    style={{
      marginTop: "5px",
      fontSize: "12px",
      opacity: 0.7,
    }}
  >
    For emailed requests, enter when
    the request was originally received.
    Leave blank for a new request.
  </div>
</label>
  </div>

  <s-button
  type="submit"
  variant="primary"
  disabled={
    navigation.state ===
      "submitting" &&
    navigation.formData?.get(
      "intent",
    ) === "add-waitlist"
  }
  loading={
    navigation.state ===
      "submitting" &&
    navigation.formData?.get(
      "intent",
    ) === "add-waitlist"
  }
>
  {navigation.state ===
      "submitting" &&
  navigation.formData?.get(
    "intent",
  ) === "add-waitlist"
    ? "Adding..."
    : "Add to Waiting List"}
</s-button>

  <div
    style={{
      marginTop: "10px",
      fontSize: "13px",
      opacity: 0.7,
    }}
  >
    Adding someone here does not
    reserve seats or charge the
    customer.
  </div>
</Form>

  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "12px",
      marginTop: "16px",
      marginBottom: "20px",
    }}
  >
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <div>
        Families Waiting
      </div>

      <strong
        style={{
          display: "block",
          fontSize: "28px",
          marginTop: "4px",
        }}
      >
        {waitlist.totalFamilies}
      </strong>
    </div>

    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <div>
        Tickets Requested
      </div>

      <strong
        style={{
          display: "block",
          fontSize: "28px",
          marginTop: "4px",
        }}
      >
        {waitlist.totalTicketsRequested}
      </strong>
    </div>
  </div>

  {waitlist.entries.length === 0 ? (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "28px",
      }}
    >
      <strong>
        No one is currently waiting
        for tickets. 🎉
      </strong>
    </div>
  ) : (
    <div
      style={{
        display: "grid",
        gap: "12px",
        marginBottom: "28px",
      }}
    >
      {waitlist.entries.map(
        (entry) => (
          <div
            key={entry.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong
                  style={{
                    fontSize: "17px",
                  }}
                >
                  {entry.customerName}
                </strong>

                <div
                  style={{
                    marginTop: "4px",
                  }}
                >
                  {entry.customerEmail}
                </div>

                {entry.customerPhone && (
                  <div
                    style={{
                      marginTop: "4px",
                    }}
                  >
                    {entry.customerPhone}
                  </div>
                )}

                <div
                  style={{
                    marginTop: "8px",
                  }}
                >
                  <strong>
                    {entry.showName}
                  </strong>
                </div>

                <div
                  style={{
                    marginTop: "4px",
                  }}
                >
                  Studio:{" "}
                  <strong>
                    {entry.account}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  textAlign: "right",
                }}
              >
                <strong
                  style={{
                    fontSize: "28px",
                  }}
                >
                  {entry.quantity}
                </strong>

                <div>
                  Ticket
                  {entry.quantity === 1
                    ? ""
                    : "s"}{" "}
                  Requested
                </div>

                <div
  style={{
    marginTop: "8px",
    fontWeight: "600",
  }}
>
  {entry.type === "EXTRA_TICKETS"
    ? "Extra Ticket Request"
    : entry.status === "OFFERED"
      ? "Offer Sent"
      : "Sold-Out Waitlist"}
</div>

{entry.requestedAt && (
  <div
    style={{
      marginTop: "4px",
      fontSize: "13px",
      opacity: 0.7,
    }}
  >
    Requested:{" "}
    {new Date(
      entry.requestedAt,
    ).toLocaleString()}
  </div>
)}

{entry.type === "EXTRA_TICKETS" &&
  entry.status === "WAITING" && (
    <Form
      method="post"
      style={{
        marginTop: "14px",
      }}
    >
      <input
        type="hidden"
        name="intent"
        value="approve-extra-tickets"
      />

      <input
        type="hidden"
        name="requestId"
        value={entry.id}
      />

      <s-button
        type="submit"
        variant="primary"
        disabled={
          navigation.state ===
            "submitting" &&
          navigation.formData?.get(
            "requestId",
          ) === entry.id
        }
        loading={
          navigation.state ===
            "submitting" &&
          navigation.formData?.get(
            "requestId",
          ) === entry.id
        }
      >
        {navigation.state ===
            "submitting" &&
        navigation.formData?.get(
          "requestId",
        ) === entry.id
          ? "Approving..."
          : "Approve & Send Invoice"}
      </s-button>
    </Form>
  )}
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  )}
</div>
          <h2>
  Family Ticket Coverage
</h2>

<p>
  Compares the Performance
  Intensive dancer roster
  against ticket purchases
  from both studios.
</p>

<div
  style={{
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginTop: "16px",
  }}
>
  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: "12px",
      padding: "16px",
    }}
  >
    <div>
      Still Need Tickets
    </div>

    <strong
      style={{
        display: "block",
        fontSize: "32px",
        marginTop: "4px",
      }}
    >
      {familyCoverage.missingFamilies}
    </strong>
  </div>

  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: "12px",
      padding: "16px",
    }}
  >
    <div>
      Fort Washington
    </div>

    <strong
      style={{
        display: "block",
        fontSize: "28px",
        marginTop: "4px",
      }}
    >
      {familyCoverage.missingFW}
    </strong>
  </div>

  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: "12px",
      padding: "16px",
    }}
  >
    <div>
      Plymouth Meeting
    </div>

    <strong
      style={{
        display: "block",
        fontSize: "28px",
        marginTop: "4px",
      }}
    >
      {familyCoverage.missingPM}
    </strong>
  </div>

  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: "12px",
      padding: "16px",
    }}
  >
    <div>
      Purchased
    </div>

    <strong
      style={{
        display: "block",
        fontSize: "28px",
        marginTop: "4px",
      }}
    >
      {familyCoverage.purchasedFamilies}
      {" / "}
      {familyCoverage.totalFamilies}
    </strong>
  </div>
</div>

<div
  style={{
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "16px",
    marginTop: "24px",
  }}
>
  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: "12px",
      padding: "18px",
    }}
  >
    <h3
      style={{
        marginTop: 0,
      }}
    >
      Fort Washington — Needs Tickets
    </h3>

    {familyCoverage.missingFWFamilies
      ?.length === 0 ? (
      <p>
        Everyone has purchased
        tickets. 🎉
      </p>
    ) : (
      <div>
        {familyCoverage.missingFWFamilies
          ?.map((family) => (
            <div
              key={family.key}
              style={{
                padding:
                  "12px 0",
                borderBottom:
                  "1px solid #eee",
              }}
            >
              <strong>
                {family.familyName}
              </strong>

              <div
                style={{
                  marginTop:
                    "3px",
                }}
              >
                {family.dancerNames.join(
                  ", ",
                )}
              </div>

              {family.email && (
                <div
                  style={{
                    marginTop:
                      "3px",
                  }}
                >
                  {family.email}
                </div>
              )}
            </div>
          ))}
      </div>
    )}
  </div>

  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: "12px",
      padding: "18px",
    }}
  >
    <h3
      style={{
        marginTop: 0,
      }}
    >
      Plymouth Meeting — Needs Tickets
    </h3>

    {familyCoverage.missingPMFamilies
      ?.length === 0 ? (
      <p>
        Everyone has purchased
        tickets. 🎉
      </p>
    ) : (
      <div>
        {familyCoverage.missingPMFamilies
          ?.map((family) => (
            <div
              key={family.key}
              style={{
                padding:
                  "12px 0",
                borderBottom:
                  "1px solid #eee",
              }}
            >
              <strong>
                {family.familyName}
              </strong>

              <div
                style={{
                  marginTop:
                    "3px",
                }}
              >
                {family.dancerNames.join(
                  ", ",
                )}
              </div>

              {family.email && (
                <div
                  style={{
                    marginTop:
                      "3px",
                  }}
                >
                  {family.email}
                </div>
              )}
            </div>
          ))}
      </div>
    )}
  </div>
</div>

          <p>
  All purchases from both
  studios are shown below.
  Orders belonging to{" "}
  <strong>
    {currentStudioName}
  </strong>{" "}
  will eventually be editable
  from this dashboard.
</p>

<div
  style={{
    marginTop: "20px",
    marginBottom: "18px",
  }}
>
  <label>
    <div
      style={{
        marginBottom: "6px",
        fontWeight: "600",
      }}
    >
      Search Ticket Sales
    </div>

    <input
      type="search"
      value={searchTerm}
      onChange={(event) =>
        setSearchTerm(
          event.target.value,
        )
      }
      placeholder="Search by customer, email, order number, show, payment method, or studio"
      style={{
        width: "100%",
        maxWidth: "620px",
        padding: "10px 12px",
        boxSizing: "border-box",
      }}
    />
  </label>
</div>

{filteredCustomers.length === 0 ? (
  <p>
    {searchTerm
      ? "No matching customers found."
      : "No customers yet."}
  </p>
) : (
  <div
    style={{
      display: "grid",
      gap: "12px",
      marginTop: "14px",
    }}
  >
    {filteredCustomers.map(

              
                (customer) => {
                  const customerStudio =
                    customer.account ===
                    "FW"
                      ? "Fort Washington"
                      : "Plymouth Meeting";

                  const belongsToCurrentStudio =
                    customer.account ===
                    account;

                  return (
                    <div
                      key={customer.id}
                      style={{
                        border:
                          "1px solid #ddd",
                        borderRadius:
                          "12px",
                        padding:
                          "16px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap: "16px",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              fontSize:
                                "17px",
                            }}
                          >
                            {
                              customer.customerName
                            }
                          </strong>

                          <div
                            style={{
                              marginTop:
                                "4px",
                            }}
                          >
                            {
                              customer.customerEmail
                            }
                          </div>

                          <div
                            style={{
                              marginTop:
                                "6px",
                            }}
                          >
                            Studio:{" "}
                            <strong>
                              {
                                customerStudio
                              }
                            </strong>
                          </div>
                        </div>

                        <div
                          style={{
                            textAlign:
                              "right",
                          }}
                        >
                          <strong
                            style={{
                              fontSize:
                                "24px",
                            }}
                          >
                            {
                              customer.totalTickets
                            }
                          </strong>

                          <div>
                            Total Ticket
                            {customer.totalTickets ===
                            1
                              ? ""
                              : "s"}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop:
                            "14px",
                          paddingTop:
                            "12px",
                          borderTop:
                            "1px solid #eee",
                        }}
                      >
                        {customer.shows.map(
                          (show) => (
                            <div
                              key={
                                show.showId
                              }
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                gap:
                                  "12px",
                                marginBottom:
                                  "6px",
                              }}
                            >
                              <span>
                                {
                                  show.showName
                                }
                              </span>

                              <strong>
                                {
                                  show.quantity
                                }
                              </strong>
                            </div>
                          ),
                        )}
                      </div>

                      <div
                        style={{
                          marginTop:
                            "10px",
                        }}
                      >
                        Payment:{" "}
                        <strong>
                          {customer.paymentMethod ===
                          "CREDIT_CARD"
                            ? "Credit Card"
                            : "Check"}
                        </strong>
                      </div>

                      {belongsToCurrentStudio && (
  <div
    style={{
      marginTop: "16px",
      paddingTop: "14px",
      borderTop: "1px solid #eee",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
      flexWrap: "wrap",
    }}
  >
    <small>
      ✓ Managed by this studio
    </small>

    <button
  type="button"
  onClick={() =>
    setEditingOrderId(
      editingOrderId === customer.id
        ? null
        : customer.id,
    )
  }
  style={{
    padding: "9px 16px",
    fontWeight: "600",
    cursor: "pointer",
  }}
>
  Edit Order
</button>
  </div>
)}

{belongsToCurrentStudio &&
  editingOrderId === customer.id && (
    <Form
      method="post"
      style={{
        marginTop: "14px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <input
        type="hidden"
        name="intent"
        value="edit-order"
      />

      <input
        type="hidden"
        name="reservationId"
        value={customer.id}
      />

      <h3
        style={{
          marginTop: 0,
          marginBottom: "6px",
        }}
      >
        Edit Ticket Order
      </h3>

      <p
        style={{
          marginTop: 0,
          marginBottom: "16px",
        }}
      >
        Change the number of tickets
        for each performance.
      </p>

      <div
        style={{
          display: "grid",
          gap: "12px",
        }}
      >
        {sales.shows.map((show) => {
          const existingShow =
            customer.shows.find(
              (customerShow) =>
                customerShow.showId ===
                show.id,
            );

          const currentQuantity =
            existingShow?.quantity ?? 0;

          return (
            <div
              key={show.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 110px",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <div>
                <strong>
                  {show.name}
                </strong>

                <div
                  style={{
                    marginTop: "3px",
                    fontSize: "13px",
                    opacity: 0.7,
                  }}
                >
                  Currently{" "}
                  {currentQuantity} ticket
                  {currentQuantity === 1
                    ? ""
                    : "s"}
                </div>
              </div>

              <input
                type="number"
                name={`quantity:${show.id}`}
                min="0"
                step="1"
                defaultValue={
                  currentQuantity
                }
                required
                style={{
                  width: "100%",
                  padding: "9px",
                  boxSizing:
                    "border-box",
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: "18px",
          display: "flex",
          gap: "10px",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setEditingOrderId(null)
          }
        >
          Cancel
        </button>

        <button
          type="submit"
          style={{
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Save Changes
        </button>
      </div>
    </Form>
  )}
</div>
);
},
)}
</div>
)}
</div>
</s-section>
</s-page>
);
}