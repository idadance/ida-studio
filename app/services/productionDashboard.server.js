import prisma from "../db.server";
import { getPerformanceRoster } from "./performanceRoster.server";

export async function getCapacityWidget() {
  const performances = await prisma.performance.findMany({
    where: {
      status: "PUBLISHED",
    },
    include: {
      shows: {
        include: {
          ticketOrders: {
  where: {
    status: {
      not: "CANCELED",
    },
  },
},
        },
      },
    },
  });

  return performances
    .flatMap((performance) =>
      performance.shows.map((show) => {
        const ticketsSold = show.ticketOrders.reduce(
          (total, order) => total + order.quantity,
          0,
        );

        const remainingSeats = Math.max(
          0,
          show.capacity - ticketsSold,
        );

        const percentFull =
          show.capacity > 0
            ? Math.round((ticketsSold / show.capacity) * 100)
            : 0;

        return {
  id: show.id,

  performanceId:
    performance.id,

  performanceName:
    performance.name,

  name: show.name,
  capacity: show.capacity,
  ticketsSold,
  remainingSeats,
  percentFull,
};
      }),
    )
    .sort((a, b) => a.remainingSeats - b.remainingSeats);
}

export async function getWorkflowWidget(
  performanceId,
) {
  const performanceFilter =
    performanceId
      ? {
          performanceId,
        }
      : {};

  const waitingForCheck =
    await prisma.reservation.count({
      where: {
        ...performanceFilter,

        paymentMethod: "CHECK",

        ticketOrders: {
          some: {
            status: "PENDING",
          },
        },
      },
    });

  return {
    waitingForCheck,

    checkReceived: 0,

    readyToDeposit: 0,
  };
}

export async function getWaitingForCheckQueue(
  account,
) {
  if (
    account !== "FW" &&
    account !== "PM"
  ) {
    throw new Error(
      "Invalid studio account.",
    );
  }

  const reservations =
    await prisma.reservation.findMany({
      where: {
        account,

        paymentMethod: "CHECK",

        ticketOrders: {
          some: {
            status: "PENDING",
          },
        },
      },

      orderBy: {
        createdAt: "asc",
      },

      include: {
        performance: true,

        ticketOrders: {
          where: {
            status: {
              not: "CANCELED",
            },
          },

          include: {
            show: true,
          },
        },
      },
    });

  const waiting = [];

  for (const reservation of reservations) {
    // ==================================
    // GROUP ACTIVE TICKETS BY SHOW
    // ==================================

    const showMap =
      new Map();

    for (
      const ticket of
      reservation.ticketOrders
    ) {
      const existing =
        showMap.get(
          ticket.showId,
        );

      if (existing) {
        existing.tickets +=
          ticket.quantity;

        existing.ticketAmount +=
          ticket.ticketSubtotal;
      } else {
        showMap.set(
          ticket.showId,
          {
            showId:
              ticket.showId,

            showName:
              ticket.show.name,

            showDate:
              ticket.show.date,

            tickets:
              ticket.quantity,

            ticketAmount:
              ticket.ticketSubtotal,

            ticketOrders: [
              ticket,
            ],
          },
        );

        continue;
      }

      existing.ticketOrders.push(
        ticket,
      );
    }

   // ==================================
// CALCULATE DIGITAL VIDEO BALANCE
//
// The reservation total includes the
// tickets plus Digital Video.
// Add the video amount only once, to
// the first unpaid show.
// ==================================

const activeTicketTotal =
  reservation.ticketOrders.reduce(
    (sum, ticket) =>
      sum +
      ticket.ticketSubtotal,
    0,
  );

const digitalVideoAmount =
  reservation.digitalVideo
    ? Math.max(
        0,
        reservation.totalAmount -
          activeTicketTotal,
      )
    : 0;

// ==================================
// FIND UNPAID SHOWS
// ==================================

const unpaidShows =
  Array.from(
    showMap.values(),
  )
    .filter((show) =>
      show.ticketOrders.some(
        (ticket) =>
          ticket.status ===
          "PENDING",
      ),
    )
    .sort((a, b) => {
      if (
        a.showDate &&
        b.showDate
      ) {
        return (
          new Date(
            a.showDate,
          ).getTime() -
          new Date(
            b.showDate,
          ).getTime()
        );
      }

      return 0;
    });

// ==================================
// CREATE ONE WAITING ITEM PER SHOW
// ==================================

for (
  const [
    showIndex,
    show,
  ] of unpaidShows.entries()
) {
  const pendingTickets =
    show.ticketOrders.filter(
      (ticket) =>
        ticket.status ===
        "PENDING",
    );

  const pendingQuantity =
    pendingTickets.reduce(
      (sum, ticket) =>
        sum +
        ticket.quantity,
      0,
    );

  const ticketAmountDue =
    pendingTickets.reduce(
      (sum, ticket) =>
        sum +
        ticket.ticketSubtotal,
      0,
    );

  const videoAmountDue =
    showIndex === 0
      ? digitalVideoAmount
      : 0;

  const amountDue =
    ticketAmountDue +
    videoAmountDue;

  waiting.push({
    id:
      `${reservation.id}:${show.showId}`,

    reservationId:
      reservation.id,

    showId:
      show.showId,

    customerName:
      reservation.customerName,

    customerEmail:
      reservation.customerEmail,

    createdAt:
      reservation.createdAt,

    performance:
      reservation.performance.name,

    showName:
      show.showName,

    showDate:
      show.showDate,

    tickets:
      pendingQuantity,

    amountDue,

    ticketAmountDue,

    videoAmountDue,

    reservationTotal:
      reservation.totalAmount,
  });
}

// CLOSES: for (const reservation of reservations)
}

return waiting.sort(
    (a, b) => {
      if (
        a.showDate &&
        b.showDate
      ) {
        const dateDifference =
          new Date(
            a.showDate,
          ).getTime() -
          new Date(
            b.showDate,
          ).getTime();

        if (
          dateDifference !== 0
        ) {
          return dateDifference;
        }
      }

      return (
        new Date(
          a.createdAt,
        ).getTime() -
        new Date(
          b.createdAt,
        ).getTime()
      );
    },
  );
}

export async function getReadyToSendQueue(
  account,
) {
  if (
    account !== "FW" &&
    account !== "PM"
  ) {
    throw new Error(
      "Invalid studio account.",
    );
  }

  const reservations =
    await prisma.reservation.findMany({
      where: {
        account,
        status: "CONFIRMED",
        ticketsSentAt: null,
      },

      orderBy: {
        createdAt: "asc",
      },

      include: {
        performance: true,

        ticketOrders: {
          where: {
            status: {
              not: "CANCELED",
            },
          },

          include: {
            show: true,
          },
        },
      },
    });

  return reservations
    .filter(
      (reservation) =>
        reservation.ticketOrders.length >
        0,
    )
    .map((reservation) => ({
      id: reservation.id,

      customerName:
        reservation.customerName,

      customerEmail:
        reservation.customerEmail,

      performance:
        reservation.performance.name,

      paymentMethod:
        reservation.paymentMethod,

      driveFolderLink:
        reservation.driveFolderLink,

      tickets:
        reservation.ticketOrders.reduce(
          (sum, ticket) =>
            sum + ticket.quantity,
          0,
        ),

      shows: [
        ...new Set(
          reservation.ticketOrders.map(
            (ticket) =>
              ticket.show.name,
          ),
        ),
      ],

      createdAt:
        reservation.createdAt,
    }));
}

export async function getRecentReservationsWidget(
  performanceId,
) {
  const performanceFilter =
    performanceId
      ? {
          performanceId,
        }
      : {};

  const reservations =
    await prisma.reservation.findMany({
      where: {
        ...performanceFilter,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 10,

      include: {
        performance: true,

        ticketOrders: {
          where: {
            status: {
              not: "CANCELED",
            },
          },

          include: {
            show: true,
          },
        },
      },
    });

  return reservations.map(
    (reservation) => ({
      id:
        reservation.id,

      customerName:
        reservation.customerName,

      createdAt:
        reservation.createdAt,

      performance:
        reservation.performance.name,

      tickets:
        reservation.ticketOrders.reduce(
          (total, order) =>
            total +
            order.quantity,
          0,
        ),

      shows:
        reservation.ticketOrders
          .map(
            (order) =>
              order.show.name,
          )
          .join(", "),
    }),
  );
}

export async function getProductionDashboard(
  performanceId,
) {
    const performances =
  await prisma.performance.findMany({
    where: {
      status: "PUBLISHED",
    },

    select: {
      id: true,
      name: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  const selectedPerformanceId =
  performanceId &&
  performances.some(
    (performance) =>
      performance.id ===
      performanceId,
  )
    ? performanceId
    : performances[0]?.id ??
      null;
  const shows = await getCapacityWidget();

  const workflow =
  await getWorkflowWidget(
    selectedPerformanceId,
  );

  const recentReservations =
  await getRecentReservationsWidget(
    selectedPerformanceId,
  );

return {
  performances,
  selectedPerformanceId,
  shows,
  workflow,
  recentReservations,
};
}

export async function getTicketSales(
  performanceId,
  options = {},
) {
  const {
    checkInOpenOnly = false,
  } = options;
  const reservations =
    await prisma.reservation.findMany({
      where: {
  performanceId,

  account: {
    in: ["FW", "PM"],
  },

  status: {
    not: "CANCELLED",
  },

  ticketOrders: {
  some: {
    status: {
      not: "CANCELED",
    },

    ...(checkInOpenOnly
      ? {
          show: {
            checkInOpen: true,
          },
        }
      : {}),
  },
},
},

      orderBy: {
        createdAt: "asc",
      },

      include: {
        performance: true,

        ticketOrders: {
  where: {
    status: {
      not: "CANCELED",
    },

    ...(checkInOpenOnly
      ? {
          show: {
            checkInOpen: true,
          },
        }
      : {}),
  },

  include: {
    show: true,
  },
},
      },
    });

  // ======================================
  // CUSTOMER / FAMILY SALES
  // BOTH STUDIOS
  // ======================================

  const customers =
    reservations.map(
      (reservation) => {
        const showMap =
          new Map();

        for (
          const ticket of
          reservation.ticketOrders
        ) {
          const existing =
            showMap.get(
              ticket.showId,
            );

          if (existing) {
  existing.quantity +=
    ticket.quantity;

  existing.checkedIn +=
    ticket.checkedInCount;

  existing.ticketAmount +=
    ticket.ticketSubtotal;

  if (
    ticket.status ===
    "PENDING"
  ) {
    existing.paymentNeeded =
      true;
  }
} else {
  showMap.set(
    ticket.showId,
    {
      showId:
        ticket.showId,

      showName:
        ticket.show.name,

      showDate:
        ticket.show.date,

      quantity:
        ticket.quantity,

      checkedIn:
        ticket.checkedInCount,

      ticketAmount:
        ticket.ticketSubtotal,

      paymentNeeded:
        ticket.status ===
        "PENDING",
    },
  );
}
        }

        const shows =
  Array.from(
    showMap.values(),
  )
    .map((show) => ({
      ...show,

      stillExpected:
        Math.max(
          0,
          show.quantity -
            show.checkedIn,
        ),
    }))
    .sort((a, b) => {
            if (
              !a.showDate ||
              !b.showDate
            ) {
              return a.showName.localeCompare(
                b.showName,
              );
            }

            return (
              new Date(
                a.showDate,
              ).getTime() -
              new Date(
                b.showDate,
              ).getTime()
            );
          });

        const totalTickets =
          shows.reduce(
            (sum, show) =>
              sum +
              show.quantity,
            0,
          );

        return {
          id:
            reservation.id,

          customerName:
            reservation.customerName,

          customerEmail:
            reservation.customerEmail,

          // Keep studio attached to the
          // customer for later management.
          account:
            reservation.account,

          performanceId:
            reservation.performanceId,

          performanceName:
            reservation.performance.name,

          paymentMethod:
  reservation.paymentMethod,

status:
  reservation.status,

digitalVideo:
  reservation.digitalVideo,

shows,

          totalTickets,

          createdAt:
            reservation.createdAt,
        };
      },
    );

  // ======================================
  // SHOW TOTALS
  // FW + PM COMBINED
  // ======================================

  const showMap = new Map();

  for (
    const reservation of
    reservations
  ) {
    for (
      const ticket of
      reservation.ticketOrders
    ) {
      const existing =
        showMap.get(
          ticket.showId,
        );

      if (existing) {
  existing.ticketsSold +=
    ticket.quantity;

  existing.checkedIn +=
    ticket.checkedInCount;
} else {
  showMap.set(
    ticket.showId,
    {
      id:
        ticket.show.id,

      performanceId:
        reservation.performanceId,

      performanceName:
        reservation.performance.name,

      name:
        ticket.show.name,

      date:
        ticket.show.date,

      capacity:
        ticket.show.capacity,

      ticketsSold:
        ticket.quantity,

      checkedIn:
        ticket.checkedInCount,
    },
  );
}
    }
  }

  const activeWaitlistOffers =
  await prisma.waitlistEntry.findMany({
    where: {
      status: "OFFERED",

      type: "SOLD_OUT",

      offerExpiresAt: {
        gt: new Date(),
      },
    },

    select: {
      showId: true,
      quantity: true,
    },
  });

const heldSeatsByShow =
  new Map();

for (
  const entry of
  activeWaitlistOffers
) {
  const current =
    heldSeatsByShow.get(
      entry.showId,
    ) ?? 0;

  heldSeatsByShow.set(
    entry.showId,
    current + entry.quantity,
  );
}

const shows =
  Array.from(
    showMap.values(),
  )
    .map((show) => {
      const heldWaitlistSeats =
        heldSeatsByShow.get(
          show.id,
        ) ?? 0;

      return {
  ...show,

  heldWaitlistSeats,

  stillExpected:
    Math.max(
      0,
      show.ticketsSold -
        show.checkedIn,
    ),

  remainingSeats:
    Math.max(
      0,
      show.capacity -
        show.ticketsSold -
        heldWaitlistSeats,
    ),
};
    })
    .sort((a, b) => {
      if (
        !a.date ||
        !b.date
      ) {
        return a.name.localeCompare(
          b.name,
        );
      }

      return (
        new Date(
          a.date,
        ).getTime() -
        new Date(
          b.date,
        ).getTime()
      );
    });

  return {
    totalReservations:
      customers.length,

    totalTickets:
      customers.reduce(
        (sum, customer) =>
          sum +
          customer.totalTickets,
        0,
      ),

    shows,

    customers,
  };
}

export async function getWaitlist(
  performanceId,
) {
  const entries =
    await prisma.waitlistEntry.findMany({
      where: {
  status: {
    in: [
      "WAITING",
      "OFFERED",
    ],
  },

  show: {
    performanceId,
  },
},

      orderBy: {
  requestedAt: "asc",
},

      include: {
        show: {
          include: {
            performance: true,
          },
        },
      },
    });

  // ======================================
  // WAITLIST ENTRIES
  // OLDEST FIRST
  // ======================================

  const waiting =
    entries.map(
      (entry, index) => ({
        id:
          entry.id,

        position:
          index + 1,

        customerName:
          entry.customerName,

        customerEmail:
          entry.customerEmail,

        customerPhone:
          entry.customerPhone,

        account:
          entry.account,

        quantity:
  entry.quantity,

type:
  entry.type,

status:
  entry.status,

showId:
  entry.showId,

        showName:
          entry.show.name,

        showDate:
          entry.show.date,

        performanceId:
          entry.show.performanceId,

        performanceName:
          entry.show.performance.name,

          requestedAt:
  entry.requestedAt,

        createdAt:
          entry.createdAt,

        offeredAt:
          entry.offeredAt,

        offerExpiresAt:
          entry.offerExpiresAt,
      }),
    );

  // ======================================
  // TOTALS BY SHOW
  // ======================================

  const showMap =
    new Map();

  for (const entry of waiting) {
    const existing =
      showMap.get(
        entry.showId,
      );

    if (existing) {
      existing.familiesWaiting += 1;
      existing.ticketsRequested +=
        entry.quantity;
    } else {
      showMap.set(
        entry.showId,
        {
          showId:
            entry.showId,

          showName:
            entry.showName,

          showDate:
            entry.showDate,

          performanceId:
            entry.performanceId,

          performanceName:
            entry.performanceName,

          familiesWaiting: 1,

          ticketsRequested:
            entry.quantity,
        },
      );
    }
  }

  const shows =
    Array.from(
      showMap.values(),
    ).sort((a, b) => {
      if (
        !a.showDate ||
        !b.showDate
      ) {
        return a.showName.localeCompare(
          b.showName,
        );
      }

      return (
        new Date(
          a.showDate,
        ).getTime() -
        new Date(
          b.showDate,
        ).getTime()
      );
    });

  return {
    totalFamilies:
      waiting.length,

    totalTicketsRequested:
      waiting.reduce(
        (sum, entry) =>
          sum + entry.quantity,
        0,
      ),

    shows,

    entries:
      waiting,
  };
}

export async function getFamilyCoverage(
  performanceId,
) {
  if (!performanceId) {
    throw new Error(
      "Performance ID is required for family coverage.",
    );
  }

  const performance =
    await prisma.performance.findUnique({
      where: {
        id: performanceId,
      },

      select: {
        id: true,
        name: true,
        rosterSheetGid: true,
      },
    });

  if (!performance) {
    throw new Error(
      "Performance not found.",
    );
  }

  const roster =
    await getPerformanceRoster(
      performance.rosterSheetGid,
    );

  const reservations =
    await prisma.reservation.findMany({
      where: {
        account: {
          in: ["FW", "PM"],
        },

        status: {
          not: "CANCELLED",
        },

        ticketOrders: {
          some: {
            status: {
              not: "CANCELED",
            },
          },
        },
      },

      select: {
        customerEmail: true,
        customerName: true,
        account: true,
      },
    });

  // ======================================
  // NORMALIZING HELPERS
  // ======================================

  function normalizeEmail(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }

  function normalizeName(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, "")
      .replace(/\s+/g, " ");
  }

  // ======================================
  // PURCHASE LOOKUPS
  // ======================================

  const purchasedEmails =
    new Set(
      reservations
        .map((reservation) =>
          normalizeEmail(
            reservation.customerEmail,
          ),
        )
        .filter(Boolean),
    );

  // ======================================
  // COMPARE ROSTER FAMILIES TO PURCHASES
  //
  // A family counts as purchased if:
  //
  // 1. ANY roster email matches a
  //    reservation email
  //
  // OR
  //
  // 2. A dancer last name matches the
  //    purchaser name in the SAME studio
  // ======================================

  const families =
    roster.families.map(
      (family) => {
        // ----------------------------------
        // EMAIL MATCH
        // Supports multiple parent emails
        // separated by ; or ,
        // ----------------------------------

        const familyEmails =
          String(
            family.email ?? "",
          )
            .split(/[;,]/)
            .map(
              (email) =>
                normalizeEmail(email),
            )
            .filter(Boolean);

        const emailMatch =
          familyEmails.some(
            (email) =>
              purchasedEmails.has(
                email,
              ),
          );

        // ----------------------------------
        // LAST NAME + STUDIO MATCH
        // ----------------------------------

        const dancerLastNames =
          new Set(
            family.dancers
              .map((dancer) =>
                normalizeName(
                  dancer.lastName,
                ),
              )
              .filter(Boolean),
          );

        const nameMatch =
          reservations.some(
            (reservation) => {
              if (
                reservation.account !==
                family.studio
              ) {
                return false;
              }

              const customerName =
                normalizeName(
                  reservation.customerName,
                );

              if (!customerName) {
                return false;
              }

              const customerWords =
                customerName.split(
                  " ",
                );

              return Array.from(
                dancerLastNames,
              ).some(
                (lastName) =>
                  customerWords.includes(
                    lastName,
                  ),
              );
            },
          );

        const hasPurchased =
          emailMatch ||
          nameMatch;

        return {
          ...family,

          hasPurchased,

          matchType:
            emailMatch
              ? "EMAIL"
              : nameMatch
                ? "NAME_AND_STUDIO"
                : null,
        };
      },
    );

  const purchased =
    families.filter(
      (family) =>
        family.hasPurchased,
    );

  const missing =
    families.filter(
      (family) =>
        !family.hasPurchased,
    );

  const missingFW =
    missing.filter(
      (family) =>
        family.studio === "FW",
    );

  const missingPM =
    missing.filter(
      (family) =>
        family.studio === "PM",
    );

  const missingStudio =
    missing.filter(
      (family) =>
        !family.studio,
    );

  return {
    totalFamilies:
      families.length,

    purchasedFamilies:
      purchased.length,

    missingFamilies:
      missing.length,

    missingFW:
      missingFW.length,

    missingPM:
      missingPM.length,

    missingStudio:
      missingStudio.length,

    families,

    purchased,

    missing,

    missingFWFamilies:
      missingFW,

    missingPMFamilies:
      missingPM,

    missingStudioFamilies:
      missingStudio,
  };
}