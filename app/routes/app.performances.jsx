import { Form, redirect, useLoaderData } from "react-router";
import { useState } from "react";
import ShowCard from "../components/ShowCard";
import PerformanceForm from "../components/PerformanceForm";
import PerformanceCard from "../components/PerformanceCard";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "");

 if (actionType === "createPerformance") {
  try {
    const name = String(formData.get("name") || "").trim();

    console.log("Creating performance:", name);

    if (!name) {
      console.log("No name supplied");
      return null;
    }

    await prisma.performance.create({
      data: {
        name,
      },
    });

    console.log("Performance created");

    return redirect("/app/performances");
  } catch (error) {
    console.error("CREATE PERFORMANCE FAILED");
    console.error(error);
    throw error;
  }
}

  if (actionType === "updatePerformance") {
    const performanceId = String(
      formData.get("performanceId") || "",
    ).trim();

    const name = String(formData.get("name") || "").trim();
    const description = String(
      formData.get("description") || "",
    ).trim();

const coverImage = String(
  formData.get("coverImage") || "",
).trim();

const rosterSheetGid = String(
  formData.get("rosterSheetGid") || "",
).trim();

const programUrl = String(
  formData.get("programUrl") || "",
).trim();

// ======================================
// PERFORMANCE VIDEO VARIANT IDS
// ======================================

const fwCheckVideoVariantId = String(
  formData.get("fwCheckVideoVariantId") || "",
).trim();

const fwCreditVideoVariantId = String(
  formData.get("fwCreditVideoVariantId") || "",
).trim();

const pmCheckVideoVariantId = String(
  formData.get("pmCheckVideoVariantId") || "",
).trim();

const pmCreditVideoVariantId = String(
  formData.get("pmCreditVideoVariantId") || "",
).trim();

const extraTicketRequestsEnabled =
  formData.get(
    "extraTicketRequestsEnabled",
  ) === "on";

const status = String(
  formData.get("status") || "DRAFT",
);

const selectedStudios = formData
  .getAll("studios")
  .map(String);

    const validStatuses = [
      "DRAFT",
      "PUBLISHED",
      "CLOSED",
      "ARCHIVED",
    ];

    if (!performanceId || !name) {
      return null;
    }

    await prisma.performance.update({
      where: {
        id: performanceId,
      },
    data: {
  name,
  description: description || null,
  coverImage: coverImage || null,
  rosterSheetGid: rosterSheetGid || null,
  programUrl: programUrl || null,

  fwCheckVideoVariantId:
    fwCheckVideoVariantId || null,

  fwCreditVideoVariantId:
    fwCreditVideoVariantId || null,

  pmCheckVideoVariantId:
    pmCheckVideoVariantId || null,

  pmCreditVideoVariantId:
  pmCreditVideoVariantId || null,

extraTicketRequestsEnabled,

status: validStatuses.includes(status)
  ? status
  : "DRAFT",

  studios: {
    set: [],

    connect: selectedStudios.map((id) => ({
      id,
    })),
  },
},
    });

    return redirect("/app/performances");
  }

  if (actionType === "deletePerformance") {
    const performanceId = String(
      formData.get("performanceId") || "",
    ).trim();

    if (!performanceId) {
      return null;
    }

    await prisma.performance.delete({
      where: {
        id: performanceId,
      },
    });

    return redirect("/app/performances");
  }

  if (actionType === "createShow") {
    const performanceId = String(
      formData.get("performanceId") || "",
    ).trim();

    const showName = String(formData.get("showName") || "").trim();
    const showDate = String(formData.get("showDate") || "").trim();
    const capacityValue = Number(formData.get("capacity"));

    if (!performanceId || !showName) {
      return null;
    }

    const capacity =
      Number.isInteger(capacityValue) && capacityValue > 0
        ? capacityValue
        : 250;

    await prisma.show.create({
      data: {
        name: showName,
        date: showDate ? new Date(showDate) : null,
        capacity,
        performanceId,
      },
    });

    return redirect("/app/performances");
  }

  if (actionType === "updateShow") {
  const showId = String(formData.get("showId") || "").trim();
  const showName = String(formData.get("showName") || "").trim();
  const showDate = String(formData.get("showDate") || "").trim();
  const capacityValue = Number(formData.get("capacity"));

  // ---------- Fort Washington ----------

const fwCheckTicketVariantId = String(
  formData.get("fwCheckTicketVariantId") || "",
).trim();

const fwCreditTicketVariantId = String(
  formData.get("fwCreditTicketVariantId") || "",
).trim();

// ---------- Plymouth Meeting ----------

const pmCheckTicketVariantId = String(
  formData.get("pmCheckTicketVariantId") || "",
).trim();

const pmCreditTicketVariantId = String(
  formData.get("pmCreditTicketVariantId") || "",
).trim();

  if (!showId || !showName) {
    return null;
  }

  const capacity =
    Number.isInteger(capacityValue) && capacityValue > 0
      ? capacityValue
      : 250;

      console.log("showDate from form:", showDate);
  await prisma.show.update({
    where: {
      id: showId,
    },
    data: {
      name: showName,
      date: showDate ? new Date(showDate) : null,
      capacity,

      fwCheckTicketVariantId:
  fwCheckTicketVariantId || null,

fwCreditTicketVariantId:
  fwCreditTicketVariantId || null,

pmCheckTicketVariantId:
  pmCheckTicketVariantId || null,

pmCreditTicketVariantId:
  pmCreditTicketVariantId || null,
    },
  });

  return redirect("/app/performances");
}

if (actionType === "toggleCheckIn") {
  const showId = String(
    formData.get("showId") || "",
  ).trim();

  const checkInOpen =
    String(
      formData.get("checkInOpen") || "",
    ) === "true";

  if (!showId) {
    return null;
  }

  await prisma.show.update({
    where: {
      id: showId,
    },

    data: {
      checkInOpen,
    },
  });

  return redirect("/app/performances");
}


  if (actionType === "deleteShow") {
    const showId = String(formData.get("showId") || "").trim();

    if (!showId) {
      return null;
    }

    await prisma.show.delete({
      where: {
        id: showId,
      },
    });

    return redirect("/app/performances");
  }

  if (actionType === "saveBoxOffice") {
    const showId = String(formData.get("showId") || "").trim();

    if (!showId) {
      return null;
    }

    const ticketPriceValue = Number(formData.get("ticketPrice"));
    const digitalVideoPriceValue = Number(
      formData.get("digitalVideoPrice"),
    );
    const ticketLimitValue = Number(formData.get("ticketLimit"));

    const ticketPrice =
      Number.isFinite(ticketPriceValue) && ticketPriceValue >= 0
        ? ticketPriceValue
        : 15;

    const digitalVideoPrice =
      Number.isFinite(digitalVideoPriceValue) &&
      digitalVideoPriceValue >= 0
        ? digitalVideoPriceValue
        : 15;

    const ticketLimit =
      Number.isInteger(ticketLimitValue) && ticketLimitValue > 0
        ? ticketLimitValue
        : 4;

    const digitalVideo = formData.get("digitalVideo") === "on";
    const creditCardEnabled =
      formData.get("creditCardEnabled") === "on";
    const checkEnabled = formData.get("checkEnabled") === "on";
    const ticketLimitEnabled =
      formData.get("ticketLimitEnabled") === "on";
    const salesOpen = formData.get("salesOpen") === "on";

    await prisma.boxOfficeSettings.upsert({
      where: {
        showId,
      },
      update: {
        ticketPrice,
        digitalVideo,
        digitalVideoPrice,
        creditCardEnabled,
        checkEnabled,
        ticketLimitEnabled,
        ticketLimit,
        salesOpen,
      },
      create: {
        showId,
        ticketPrice,
        digitalVideo,
        digitalVideoPrice,
        creditCardEnabled,
        checkEnabled,
        ticketLimitEnabled,
        ticketLimit,
        salesOpen,
      },
    });

    return redirect("/app/performances");
  }

  return null;
};

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const performances = await prisma.performance.findMany({
    include: {
  studios: true,
      shows: {
  include: {
    boxOffice: true,

    ticketOrders: {
      where: {
        status: {
          not: "CANCELED",
        },
      },
    },

    waitlistEntries: {
      where: {
        status: "OFFERED",

        offerExpiresAt: {
          gt: new Date(),
        },
      },
    },
  },
        orderBy: [
          {
            date: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

const studios = await prisma.studio.findMany({
  orderBy: {
    name: "asc",
  },
});

  return {
  performances,
  studios,
};
};

function formatShowDate(dateValue) {
  if (!dateValue) {
    return "Date not set";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateTimeInput(dateValue) {
  if (!dateValue) {
    return "";
  }

  return new Date(dateValue)
    .toISOString()
    .slice(0, 16);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

const fieldStyle = {
  boxSizing: "border-box",
  width: "100%",
  padding: "10px",
  border: "1px solid #ccc",
  borderRadius: "6px",
};

const formPanelStyle = {
  display: "grid",
  gap: "14px",
  maxWidth: "540px",
  padding: "16px",
  background: "#f6f6f7",
  borderRadius: "8px",
};

export default function Performances() {
  const {
  performances,
  studios,
} = useLoaderData();

  const [expandedId, setExpandedId] = useState(null);
  const [editingPerformanceId, setEditingPerformanceId] =
    useState(null);
  const [addingShowToId, setAddingShowToId] = useState(null);
  const [editingShowId, setEditingShowId] = useState(null);
  const [boxOfficeShowId, setBoxOfficeShowId] = useState(null);

  const closeShowPanels = () => {
    setAddingShowToId(null);
    setEditingShowId(null);
    setBoxOfficeShowId(null);
  };

  const toggleShows = (performanceId) => {
    setExpandedId((currentId) =>
      currentId === performanceId ? null : performanceId,
    );

    setEditingPerformanceId(null);
    closeShowPanels();
  };

  const toggleEditPerformance = (performanceId) => {
    setEditingPerformanceId((currentId) =>
      currentId === performanceId ? null : performanceId,
    );

    closeShowPanels();
  };

  const toggleAddShow = (performanceId) => {
    setAddingShowToId((currentId) =>
      currentId === performanceId ? null : performanceId,
    );

    setEditingPerformanceId(null);
    setEditingShowId(null);
    setBoxOfficeShowId(null);
  };

  const toggleEditShow = (showId) => {
    setEditingShowId((currentId) =>
      currentId === showId ? null : showId,
    );

    setEditingPerformanceId(null);
    setAddingShowToId(null);
    setBoxOfficeShowId(null);
  };

  const toggleBoxOffice = (showId) => {
    setBoxOfficeShowId((currentId) =>
      currentId === showId ? null : showId,
    );

    setEditingPerformanceId(null);
    setAddingShowToId(null);
    setEditingShowId(null);
  };

  return (
    <s-page heading="Performances">
      <s-section heading="Create Performance">
  <Form method="post">
    <input
      type="hidden"
      name="_action"
      value="createPerformance"
    />

    <div
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <label style={{ flex: 1, minWidth: "300px" }}>
        <div
          style={{
            marginBottom: "6px",
            fontWeight: "600",
          }}
        >
          Performance Name
        </div>

        <input
          type="text"
          name="name"
          placeholder="2027 Recital"
          required
          style={fieldStyle}
        />
      </label>

      <button type="submit">
        Create Performance
      </button>
    </div>
  </Form>
</s-section>

      <s-section heading="Your Performances">
        {performances.length === 0 ? (
          <s-paragraph>No performances yet.</s-paragraph>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {performances.map((performance) => {
              const isExpanded = expandedId === performance.id;
              const isEditingPerformance =
                editingPerformanceId === performance.id;
              const isAddingShow =
                addingShowToId === performance.id;

              return (
                <PerformanceCard
  key={performance.id}
  performance={performance}
studios={studios}
  isExpanded={isExpanded}
  isEditing={isEditingPerformance}
  onToggleShows={() => toggleShows(performance.id)}
  onToggleEdit={() => toggleEditPerformance(performance.id)}
  onCancelEdit={() => setEditingPerformanceId(null)}
>
                  {!isEditingPerformance && isExpanded && (
                    <div
                      style={{
                        marginTop: "20px",
                        paddingTop: "16px",
                        borderTop: "1px solid #ddd",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "10px",
                          marginBottom: "16px",
                        }}
                      >
                        <h4 style={{ margin: 0 }}>Shows</h4>

                        <button
                          type="button"
                          onClick={() =>
                            toggleAddShow(performance.id)
                          }
                        >
                          {isAddingShow ? "Cancel" : "+ Add Show"}
                        </button>
                      </div>

                      {isAddingShow && (
                        <Form method="post">
                          <input
                            type="hidden"
                            name="_action"
                            value="createShow"
                          />

                          <input
                            type="hidden"
                            name="performanceId"
                            value={performance.id}
                          />

                          <div
                            style={{
                              ...formPanelStyle,
                              marginBottom: "20px",
                            }}
                          >
                            <h5
                              style={{
                                margin: 0,
                                fontSize: "16px",
                              }}
                            >
                              Add Show
                            </h5>

                            <label>
                              <div
                                style={{
                                  marginBottom: "6px",
                                  fontWeight: "600",
                                }}
                              >
                                Show name
                              </div>

                              <input
                                type="text"
                                name="showName"
                                placeholder="Friday 6:30 PM"
                                required
                                style={fieldStyle}
                              />
                            </label>

                            <label>
                              <div
                                style={{
                                  marginBottom: "6px",
                                  fontWeight: "600",
                                }}
                              >
                                Date and time
                              </div>

                              <input
                                type="datetime-local"
                                name="showDate"
                                style={fieldStyle}
                              />
                            </label>

                            <label>
                              <div
                                style={{
                                  marginBottom: "6px",
                                  fontWeight: "600",
                                }}
                              >
                                Seating capacity
                              </div>

                              <input
                                type="number"
                                name="capacity"
                                defaultValue="250"
                                min="1"
                                required
                                style={fieldStyle}
                              />
                            </label>

                            <div>
                              <button type="submit">
                                Save Show
                              </button>
                            </div>
                          </div>
                        </Form>
                      )}

                      {performance.shows.length === 0 ? (
                        <p>No shows yet.</p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                          }}
                        >
                          {performance.shows.map((show) => {
                            const isEditing =
                              editingShowId === show.id;

                            const isBoxOfficeOpen =
                              boxOfficeShowId === show.id;

                            const settings = show.boxOffice || {
                              ticketPrice: 15,
                              digitalVideo: false,
                              digitalVideoPrice: 15,
                              creditCardEnabled: true,
                              checkEnabled: true,
                              ticketLimitEnabled: false,
                              ticketLimit: 4,
                              salesOpen: false,
                            };
const formattedDate = formatShowDate(show.date);
const formattedPrice = formatMoney(settings.ticketPrice);
const showView = {
  ...show,
  formattedDate,
};
const displaySettings = {
  ...settings,
  formattedPrice,
};
const ticketsSold =
  show.ticketOrders.reduce(
    (total, order) =>
      total + order.quantity,
    0,
  );

const heldWaitlistSeats =
  show.waitlistEntries.reduce(
    (total, entry) =>
      total + entry.quantity,
    0,
  );

const remainingSeats = Math.max(
  0,
  show.capacity -
    ticketsSold -
    heldWaitlistSeats,
);

const soldOut =
  remainingSeats === 0;

                            return (
                              <ShowCard
  key={show.id}
  show={showView}
  settings={displaySettings}
  isEditing={isEditing}
  isBoxOfficeOpen={isBoxOfficeOpen}
  onEdit={() => toggleEditShow(show.id)}
  onBoxOffice={() => toggleBoxOffice(show.id)}
  ticketsSold={ticketsSold}
remainingSeats={remainingSeats}
soldOut={soldOut}
>
                                
                                {isEditing ? (
                                  <Form method="post">
                                    <input
                                      type="hidden"
                                      name="_action"
                                      value="updateShow"
                                    />

                                    <input
                                      type="hidden"
                                      name="showId"
                                      value={show.id}
                                    />

                                    <div style={formPanelStyle}>
                                      <h5
                                        style={{
                                          margin: 0,
                                          fontSize: "16px",
                                        }}
                                      >
                                        Edit Show
                                      </h5>

                                      <label>
                                        <div
                                          style={{
                                            marginBottom: "6px",
                                            fontWeight: "600",
                                          }}
                                        >
                                          Show name
                                        </div>

                                        <input
                                          type="text"
                                          name="showName"
                                          defaultValue={show.name}
                                          required
                                          style={fieldStyle}
                                        />
                                      </label>

                                      <label>
                                        <div
                                          style={{
                                            marginBottom: "6px",
                                            fontWeight: "600",
                                          }}
                                        >
                                          Date and time
                                        </div>

                                        <input
                                          type="datetime-local"
                                          name="showDate"
                                          defaultValue={formatDateTimeInput(
                                            show.date,
                                          )}
                                          style={fieldStyle}
                                        />
                                      </label>

                                      <label>
                                        <div
                                          style={{
                                            marginBottom: "6px",
                                            fontWeight: "600",
                                          }}
                                        >
                                          Seating capacity
                                        </div>



                                        <input
                                          type="number"
                                          name="capacity"
                                          defaultValue={show.capacity}
                                          min="1"
                                          required
                                          style={fieldStyle}
                                        />
                                      </label>
<h4 style={{ margin: "8px 0 0" }}>
  Shopify Products
</h4>

<div
  style={{
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
  }}
>
  <h5 style={{ marginTop: 0 }}>
    Fort Washington
  </h5>

  <label>
    <div style={{ marginBottom: "6px", fontWeight: "600" }}>
      Credit Ticket Variant ID
    </div>

    <input
      type="text"
      name="fwCreditTicketVariantId"
      defaultValue={show.fwCreditTicketVariantId ?? ""}
      style={fieldStyle}
    />
  </label>

  <label>
    <div style={{ marginBottom: "6px", fontWeight: "600" }}>
      Check Ticket Variant ID
    </div>

    <input
      type="text"
      name="fwCheckTicketVariantId"
      defaultValue={show.fwCheckTicketVariantId ?? ""}
      style={fieldStyle}
    />
  </label>

  
</div>

<div
  style={{
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
  }}
>
  <h5 style={{ marginTop: 0 }}>
    Plymouth Meeting
  </h5>

  <label>
    <div style={{ marginBottom: "6px", fontWeight: "600" }}>
      Credit Ticket Variant ID
    </div>

    <input
      type="text"
      name="pmCreditTicketVariantId"
      defaultValue={show.pmCreditTicketVariantId ?? ""}
      style={fieldStyle}
    />
  </label>

  <label>
    <div style={{ marginBottom: "6px", fontWeight: "600" }}>
      Check Ticket Variant ID
    </div>

    <input
      type="text"
      name="pmCheckTicketVariantId"
      defaultValue={show.pmCheckTicketVariantId ?? ""}
      style={fieldStyle}
    />
  </label>
</div>

                                      <div
                                        style={{
                                          display: "flex",
                                          flexWrap: "wrap",
                                          gap: "10px",
                                        }}
                                      >
                                        <button type="submit">
                                          Save Changes
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingShowId(null)
                                          }
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  </Form>
                                ) : (
                                  <>
                                    <h5
                                      style={{
                                        marginTop: 0,
                                        marginBottom: "8px",
                                        fontSize: "17px",
                                      }}
                                    >
                                      🎟️ {show.name}
                                    </h5>

                                    <p style={{ margin: "0 0 8px" }}>
                                      📅 {formatShowDate(show.date)}
                                    </p>

                                    <>
  <p style={{ margin: "0 0 6px" }}>
    💺 Capacity: {show.capacity}
  </p>

  <p
    style={{
      margin: "0 0 10px",
      fontWeight: "600",
      color: soldOut ? "#c62828" : "#2e7d32",
    }}
  >
    {soldOut
      ? "🔴 SOLD OUT"
      : `🟢 Remaining: ${remainingSeats}`}
  </p>
</>

                                    <p style={{ margin: "0 0 14px" }}>
                                      {settings.salesOpen
                                        ? "🟢 Ticket sales open"
                                        : "⚪ Ticket sales closed"}
                                      {" · "}
                                      {formatMoney(
                                        settings.ticketPrice,
                                      )}
                                    </p>

                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "10px",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleEditShow(show.id)
                                        }
                                      >
                                        Edit Show
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleBoxOffice(show.id)
                                        }
                                      >
                                        {isBoxOfficeOpen
                                          ? "Close Box Office"
                                          : "🎟 Box Office"}
                                      </button>

                                      <Form
                                        method="post"
                                        onSubmit={(event) => {
                                          const confirmed =
                                            window.confirm(
                                              `Delete "${show.name}"? This cannot be undone.`,
                                            );

                                          if (!confirmed) {
                                            event.preventDefault();
                                          }
                                        }}
                                      >
                                        <input
                                          type="hidden"
                                          name="_action"
                                          value="deleteShow"
                                        />

                                        <input
                                          type="hidden"
                                          name="showId"
                                          value={show.id}
                                        />

                                        <button type="submit">
                                          Delete Show
                                        </button>
                                      </Form>
                                    </div>

                                    {isBoxOfficeOpen && (
                                      <div
                                        style={{
                                          marginTop: "18px",
                                          paddingTop: "18px",
                                          borderTop:
                                            "1px solid #ddd",
                                        }}
                                      >
                                        <Form method="post">
                                          <input
                                            type="hidden"
                                            name="_action"
                                            value="saveBoxOffice"
                                          />

                                          <input
                                            type="hidden"
                                            name="showId"
                                            value={show.id}
                                          />

                                          <div style={formPanelStyle}>
                                            <h5
                                              style={{
                                                margin: 0,
                                                fontSize: "18px",
                                              }}
                                            >
                                              🎟 Box Office
                                            </h5>

                                            <label>
                                              <div
                                                style={{
                                                  marginBottom: "6px",
                                                  fontWeight: "600",
                                                }}
                                              >
                                                Ticket price
                                              </div>

                                              <input
                                                type="number"
                                                name="ticketPrice"
                                                defaultValue={
                                                  settings.ticketPrice
                                                }
                                                min="0"
                                                step="0.01"
                                                required
                                                style={fieldStyle}
                                              />
                                            </label>

                                            <label
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                name="digitalVideo"
                                                defaultChecked={
                                                  settings.digitalVideo
                                                }
                                              />

                                              Offer digital video
                                            </label>

                                            <label>
                                              <div
                                                style={{
                                                  marginBottom: "6px",
                                                  fontWeight: "600",
                                                }}
                                              >
                                                Digital video price
                                              </div>

                                              <input
                                                type="number"
                                                name="digitalVideoPrice"
                                                defaultValue={
                                                  settings.digitalVideoPrice
                                                }
                                                min="0"
                                                step="0.01"
                                                required
                                                style={fieldStyle}
                                              />
                                            </label>

                                            <div>
                                              <div
                                                style={{
                                                  marginBottom: "8px",
                                                  fontWeight: "600",
                                                }}
                                              >
                                                Payment methods
                                              </div>

                                              <div
                                                style={{
                                                  display: "grid",
                                                  gap: "8px",
                                                }}
                                              >
                                                <label
                                                  style={{
                                                    display: "flex",
                                                    alignItems:
                                                      "center",
                                                    gap: "8px",
                                                  }}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    name="creditCardEnabled"
                                                    defaultChecked={
                                                      settings.creditCardEnabled
                                                    }
                                                  />

                                                  Credit card
                                                </label>

                                                <label
                                                  style={{
                                                    display: "flex",
                                                    alignItems:
                                                      "center",
                                                    gap: "8px",
                                                  }}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    name="checkEnabled"
                                                    defaultChecked={
                                                      settings.checkEnabled
                                                    }
                                                  />

                                                  Check
                                                </label>
                                              </div>
                                            </div>

                                            <label
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                name="ticketLimitEnabled"
                                                defaultChecked={
                                                  settings.ticketLimitEnabled
                                                }
                                              />

                                              Limit tickets per customer
                                            </label>

                                            <label>
                                              <div
                                                style={{
                                                  marginBottom: "6px",
                                                  fontWeight: "600",
                                                }}
                                              >
                                                Ticket limit
                                              </div>

                                              <input
                                                type="number"
                                                name="ticketLimit"
                                                defaultValue={
                                                  settings.ticketLimit
                                                }
                                                min="1"
                                                required
                                                style={fieldStyle}
                                              />
                                            </label>

                                            <label
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                name="salesOpen"
                                                defaultChecked={
                                                  settings.salesOpen
                                                }
                                              />

                                              Open ticket sales
                                            </label>

                                            <div>
                                              <button type="submit">
                                                Save Box Office
                                              </button>
                                            </div>
                                          </div>
                                        </Form>
                                      </div>
                                    )}
                                  </>
                                )}
                              </ShowCard>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </PerformanceCard>
              );
            })}
          </div>
        )}
      </s-section>
    </s-page>
  );
}