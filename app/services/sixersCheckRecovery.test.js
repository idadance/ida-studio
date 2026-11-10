import test from "node:test";
import assert from "node:assert/strict";

import prisma from "../db.server";

import {
  claimSixersCheckProcessing,
  confirmSixersCheckReservation,
  recoverSixersCheckProcessing,
  receiveSixersCheck,
} from "./sixersCheckPayment.server.ts";

import {
  verifySixersPaidOrderMatch,
  confirmSixersPaidReservation,
  reconcileSixersPaidCheck,
} from "./sixersCheckReconciliation.server.ts";

const buildReservation = (overrides = {}) => ({
  id: "res-1",
  status: "PENDING",
  paymentMethod: "CHECK",
  quantity: 2,
  totalAmount: 120,
  checkNumber: "CHK-42",
  checkReceivedAt: null,
  shopifyDraftOrderId: "gid://shopify/DraftOrder/123",
  shopifyDraftStatus: "CREATED",
  shopifyOrderId: null,
  shopifyOrderNumber: null,
  eventLocation: { studioCode: "FW" },
  ticketTier: {
    event: { type: "TICKET_SALE" },
    fwCheckVariantId: "111",
    pmCheckVariantId: "222",
  },
  ...overrides,
});

const basePaidOrder = {
  id: "gid://shopify/Order/456",
  name: "#456",
  displayFinancialStatus: "PAID",
  currencyCode: "USD",
  customAttributes: [{ key: "Sixers Reservation ID", value: "res-1" }],
  lineItems: {
    nodes: [{ quantity: 2, variant: { id: "gid://shopify/ProductVariant/111" } }],
  },
  totalPriceSet: { shopMoney: { amount: "120.00", currencyCode: "USD" } },
};

test("claimSixersCheckProcessing reserves the draft for a single retry window", async () => {
  const calls = [];

  const prismaClient = {
    eventReservation: {
      updateMany: async ({ where }) => {
        calls.push(where);
        return { count: 1 };
      },
    },
  };

  const claimed = await claimSixersCheckProcessing({
    reservationId: "res-1",
    expectedDraftOrderId: "gid://shopify/DraftOrder/123",
    prismaClient,
  });

  assert.equal(claimed, true);
  assert.equal(calls[0].id, "res-1");
  assert.equal(calls[0].status, "PENDING");
  assert.deepEqual(calls[0].shopifyDraftStatus.in, ["CREATED", "PROCESSING"]);
  assert.equal(calls[0].shopifyDraftOrderId, "gid://shopify/DraftOrder/123");
});

test("confirmSixersCheckReservation stores the check number and marks the reservation confirmed", async () => {
  const captured = {};

  const prismaClient = {
    eventReservation: {
      findUnique: async () => ({
        id: "res-1",
        status: "PENDING",
        paymentMethod: "CHECK",
        checkNumber: null,
        checkReceivedAt: null,
        shopifyDraftOrderId: "gid://shopify/DraftOrder/123",
        shopifyOrderId: null,
        shopifyOrderNumber: null,
      }),
      updateMany: async ({ where, data }) => {
        captured.where = where;
        captured.data = data;
        return { count: 1 };
      },
    },
  };

  const result = await confirmSixersCheckReservation({
    reservationId: "res-1",
    shopifyOrder: {
      id: "gid://shopify/Order/456",
      name: "#456",
      displayFinancialStatus: "PAID",
    },
    checkNumber: "CHK-42",
    prismaClient,
  });

  assert.equal(result.success, true);
  assert.equal(captured.data.status, "CONFIRMED");
  assert.equal(captured.data.checkNumber, "CHK-42");
  assert.equal(captured.data.shopifyOrderId, "456");
  assert.equal(captured.data.shopifyOrderNumber, "#456");
  assert.equal(captured.data.shopifyDraftStatus, "COMPLETED");
  assert.deepEqual(captured.where.status.in, ["PENDING", "PROCESSING"]);
});

test("confirmSixersCheckReservation rejects duplicate confirmation with a different stored Shopify order", async () => {
  const prismaClient = {
    eventReservation: {
      findUnique: async () => ({
        id: "res-1",
        status: "CONFIRMED",
        paymentMethod: "CHECK",
        shopifyDraftOrderId: "gid://shopify/DraftOrder/123",
        shopifyOrderId: "999",
        shopifyOrderNumber: "#999",
      }),
    },
  };

  await assert.rejects(
    () =>
      confirmSixersCheckReservation({
        reservationId: "res-1",
        shopifyOrder: {
          id: "gid://shopify/Order/456",
          name: "#456",
        },
        checkNumber: "CHK-42",
        prismaClient,
      }),
    /different Shopify order/i,
  );
});

test("confirmSixersCheckReservation fails closed when Shopify verifies payment but the local DB write fails", async () => {
  const prismaClient = {
    eventReservation: {
      findUnique: async () => ({
        id: "res-1",
        status: "PENDING",
        paymentMethod: "CHECK",
        checkNumber: "CHK-42",
        checkReceivedAt: null,
        shopifyDraftOrderId: "gid://shopify/DraftOrder/123",
        shopifyOrderId: null,
        shopifyOrderNumber: null,
      }),
      updateMany: async () => ({ count: 0 }),
      findUniqueAfter: async () => ({
        id: "res-1",
        status: "PENDING",
        shopifyOrderId: null,
      }),
    },
  };

  await assert.rejects(
    () =>
      confirmSixersCheckReservation({
        reservationId: "res-1",
        shopifyOrder: {
          id: "gid://shopify/Order/456",
          name: "#456",
          displayFinancialStatus: "PAID",
        },
        checkNumber: "CHK-42",
        prismaClient,
      }),
    /reservation changed during confirmation|manual review required/i,
  );
});

test("processSixersCheckReceipt completes a successful pending check payment without bypassing the production lock", async () => {
  const reservation = buildReservation({
    status: "PENDING",
    shopifyDraftStatus: "CREATED",
    checkNumber: null,
  });

  const calls = {
    claim: 0,
    confirm: 0,
    review: 0,
  };

  const originalReviewUpdateMany = prisma.sixersPaymentReview.updateMany;
  prisma.sixersPaymentReview.updateMany = async () => {
    calls.review += 1;
    return { count: 1 };
  };

  const prismaMock = {
    eventReservation: {
      findUnique: async () => reservation,
      updateMany: async ({ data }) => {
        if (data.shopifyDraftStatus === "PROCESSING") {
          calls.claim += 1;
          return { count: 1 };
        }

        if (data.status === "CONFIRMED") {
          calls.confirm += 1;
          return { count: 1 };
        }

        return { count: 0 };
      },
    },
  };

  const admin = {
    graphql: async (query) => {
      if (query.includes("mutation CompleteSixersDraft")) {
        return {
          json: async () => ({
            data: {
              draftOrderComplete: {
                draftOrder: {
                  order: {
                    id: "gid://shopify/Order/456",
                    name: "#456",
                    displayFinancialStatus: "PAID",
                  },
                },
              },
            },
          }),
        };
      }

      return {
        json: async () => ({ data: { draftOrder: {
          id: "gid://shopify/DraftOrder/123",
          status: "OPEN",
          totalPrice: "120.00",
          customAttributes: [{ key: "Sixers Reservation ID", value: "res-1" }],
          lineItems: {
            nodes: [{ quantity: 2, variant: { id: "gid://shopify/ProductVariant/111" } }],
          },
        } } }),
      };
    },
  };

  const { processSixersCheckReceipt } = await import("./sixersCheckPayment.server.ts");

  try {
    const result = await processSixersCheckReceipt({
      reservationId: "res-1",
      checkNumber: "CHK-42",
      account: "FW",
      admin,
      prismaClient: prismaMock,
    });

    assert.equal(result.success, true);
    assert.equal(result.shopifyOrderNumber, "#456");
    assert.equal(calls.claim, 1);
    assert.equal(calls.confirm, 1);
    assert.equal(calls.review, 1);
    assert.equal(result.reservationId, "res-1");
  } finally {
    prisma.sixersPaymentReview.updateMany = originalReviewUpdateMany;
  }
});

test("receiveSixersCheck blocks payment when the feature flag is absent", async () => {
  const reservation = buildReservation({
    status: "PENDING",
    shopifyDraftStatus: "CREATED",
    checkNumber: null,
  });
  const originalFindUnique = prisma.eventReservation.findUnique;
  const originalFlag = process.env.ENABLE_SIXERS_CHECK_PAYMENTS;

  delete process.env.ENABLE_SIXERS_CHECK_PAYMENTS;
  prisma.eventReservation.findUnique = async () => reservation;

  try {
    await assert.rejects(
      () =>
        receiveSixersCheck({
          reservationId: "res-1",
          checkNumber: "CHK-42",
          account: "FW",
          admin: {
            graphql: async () => {
              throw new Error("blocked admin call should not run");
            },
          },
        }),
      /not enabled yet/i,
    );

    assert.equal(reservation.checkNumber, null);
  } finally {
    prisma.eventReservation.findUnique = originalFindUnique;
    if (originalFlag === undefined) {
      delete process.env.ENABLE_SIXERS_CHECK_PAYMENTS;
    } else {
      process.env.ENABLE_SIXERS_CHECK_PAYMENTS = originalFlag;
    }
  }
});

test("receiveSixersCheck blocks payment when the feature flag is false", async () => {
  const reservation = buildReservation({
    status: "PENDING",
    shopifyDraftStatus: "CREATED",
    checkNumber: null,
  });
  const originalFindUnique = prisma.eventReservation.findUnique;
  const originalFlag = process.env.ENABLE_SIXERS_CHECK_PAYMENTS;

  process.env.ENABLE_SIXERS_CHECK_PAYMENTS = "false";
  prisma.eventReservation.findUnique = async () => reservation;

  try {
    await assert.rejects(
      () =>
        receiveSixersCheck({
          reservationId: "res-1",
          checkNumber: "CHK-42",
          account: "FW",
          admin: {
            graphql: async () => {
              throw new Error("blocked admin call should not run");
            },
          },
        }),
      /not enabled yet/i,
    );

    assert.equal(reservation.checkNumber, null);
  } finally {
    prisma.eventReservation.findUnique = originalFindUnique;
    if (originalFlag === undefined) {
      delete process.env.ENABLE_SIXERS_CHECK_PAYMENTS;
    } else {
      process.env.ENABLE_SIXERS_CHECK_PAYMENTS = originalFlag;
    }
  }
});

test("receiveSixersCheck reaches the tested payment implementation when the feature flag is true", async () => {
  const reservation = buildReservation({
    status: "PENDING",
    shopifyDraftStatus: "CREATED",
    checkNumber: null,
  });
  const originalFindUnique = prisma.eventReservation.findUnique;
  const originalUpdateMany = prisma.eventReservation.updateMany;
  const originalReviewUpdateMany = prisma.sixersPaymentReview.updateMany;
  const originalFlag = process.env.ENABLE_SIXERS_CHECK_PAYMENTS;

  process.env.ENABLE_SIXERS_CHECK_PAYMENTS = "true";
  prisma.eventReservation.findUnique = async () => reservation;
  prisma.eventReservation.updateMany = async ({ data }) => {
    if (data.shopifyDraftStatus === "PROCESSING") {
      return { count: 1 };
    }
    if (data.status === "CONFIRMED") {
      return { count: 1 };
    }
    return { count: 1 };
  };
  prisma.sixersPaymentReview.updateMany = async () => ({ count: 1 });

  const admin = {
    graphql: async (query) => {
      if (query.includes("query SixersDraftOrder")) {
        return {
          json: async () => ({
            data: {
              draftOrder: {
                id: "gid://shopify/DraftOrder/123",
                status: "OPEN",
                totalPrice: "120.00",
                customAttributes: [{ key: "Sixers Reservation ID", value: "res-1" }],
                lineItems: {
                  nodes: [{ quantity: 2, variant: { id: "gid://shopify/ProductVariant/111" } }],
                },
              },
            },
          }),
        };
      }

      return {
        json: async () => ({
          data: {
            draftOrderComplete: {
              draftOrder: {
                order: {
                  id: "gid://shopify/Order/456",
                  name: "#456",
                  displayFinancialStatus: "PAID",
                },
              },
            },
          },
        }),
      };
    },
  };

  try {
    const result = await receiveSixersCheck({
      reservationId: "res-1",
      checkNumber: "CHK-42",
      account: "FW",
      admin,
    });

    assert.equal(result.success, true);
    assert.equal(result.shopifyOrderNumber, "#456");
    assert.equal(result.reservationId, "res-1");
    assert.equal("qrCode" in result, false);
  } finally {
    prisma.eventReservation.findUnique = originalFindUnique;
    prisma.eventReservation.updateMany = originalUpdateMany;
    prisma.sixersPaymentReview.updateMany = originalReviewUpdateMany;
    if (originalFlag === undefined) {
      delete process.env.ENABLE_SIXERS_CHECK_PAYMENTS;
    } else {
      process.env.ENABLE_SIXERS_CHECK_PAYMENTS = originalFlag;
    }
  }
});

test("receiveSixersCheck routes an already-paid draft through reconciliation instead of re-completing", async () => {
  const reservation = buildReservation({
    status: "PENDING",
    shopifyDraftStatus: "CREATED",
    shopifyOrderId: null,
  });
  const originalFindUnique = prisma.eventReservation.findUnique;

  prisma.eventReservation.findUnique = async () => reservation;

  try {
    await assert.rejects(
      () =>
        receiveSixersCheck({
          reservationId: "res-1",
          checkNumber: "CHK-42",
          account: "FW",
          admin: {
            graphql: async () => ({
              json: async () => ({
                data: {
                  draftOrder: {
                    id: "gid://shopify/DraftOrder/123",
                    status: "COMPLETED",
                    totalPrice: "120.00",
                    order: {
                      id: "gid://shopify/Order/456",
                      name: "#456",
                      displayFinancialStatus: "PAID",
                    },
                    customAttributes: [{ key: "Sixers Reservation ID", value: "res-1" }],
                    lineItems: {
                      nodes: [{ quantity: 2, variant: { id: "gid://shopify/ProductVariant/111" } }],
                    },
                  },
                },
              }),
            }),
          },
        }),
      /not enabled yet|Shopify has not verified|manual review required/i,
    );
  } finally {
    prisma.eventReservation.findUnique = originalFindUnique;
  }
});

test("verifySixersPaidOrderMatch rejects incorrect variant or quantity before confirmation", async () => {
  const reservation = {
    id: "res-1",
    quantity: 2,
    totalAmount: 120,
    paymentMethod: "CHECK",
    eventLocation: { studioCode: "FW" },
    ticketTier: { fwCheckVariantId: "111", pmCheckVariantId: "222" },
  };

  const order = {
    id: "gid://shopify/Order/456",
    name: "#456",
    currencyCode: "USD",
    customAttributes: [{ key: "Sixers Reservation ID", value: "res-1" }],
    lineItems: {
      nodes: [{ quantity: 1, variant: { id: "gid://shopify/ProductVariant/999" } }],
    },
    totalPriceSet: { shopMoney: { amount: "120.00", currencyCode: "USD" } },
  };

  await assert.rejects(
    () =>
      verifySixersPaidOrderMatch({
        reservation,
        shop: "ida-dance-store.myshopify.com",
        shopifyOrderId: "gid://shopify/Order/456",
        order,
      }),
    /ticket tier.*quantity|does not match/i,
  );
});

test("confirmSixersPaidReservation is idempotent when the reservation is already confirmed for the same order", async () => {
  const prismaClient = {
    eventReservation: {
      findUnique: async () => ({
        id: "res-1",
        status: "CONFIRMED",
        paymentMethod: "CHECK",
        shopifyOrderId: "456",
        shopifyOrderNumber: "#456",
      }),
    },
  };

  const result = await confirmSixersPaidReservation({
    reservationId: "res-1",
    shop: "ida-dance-store.myshopify.com",
    shopifyOrderId: "gid://shopify/Order/456",
    shopifyOrderNumber: "#456",
    checkNumber: "CHK-42",
    admin: {},
    prismaClient,
  });

  assert.equal(result.success, true);
  assert.equal(result.alreadyConfirmed, true);
  assert.equal(result.reservationId, "res-1");
});

test("recoverSixersCheckProcessing refuses a second completion when Shopify is still OPEN", async () => {
  const reservation = buildReservation();
  const originalFindUnique = prisma.eventReservation.findUnique;
  const originalUpdateMany = prisma.eventReservation.updateMany;

  prisma.eventReservation.findUnique = async () => reservation;
  prisma.eventReservation.updateMany = async () => ({ count: 0 });

  try {
    const admin = {
      graphql: async () => ({
        json: async () => ({
          data: {
            draftOrder: {
              id: "gid://shopify/DraftOrder/123",
              status: "OPEN",
              totalPrice: "120.00",
              customAttributes: [{ key: "Sixers Reservation ID", value: "res-1" }],
              lineItems: {
                nodes: [{ quantity: 2, variant: { id: "gid://shopify/ProductVariant/111" } }],
              },
            },
          },
        }),
      }),
    };

    await assert.rejects(
      () => recoverSixersCheckProcessing({ reservationId: "res-1", account: "FW", admin, prismaClient: prisma }),
      /already being processed|needs review|retry/i,
    );
  } finally {
    prisma.eventReservation.findUnique = originalFindUnique;
    prisma.eventReservation.updateMany = originalUpdateMany;
  }
});

test("receiveSixersCheck blocks a second submission before draft completion and preserves the check number", async () => {
  const reservation = buildReservation({ status: "PENDING", shopifyDraftStatus: "PROCESSING" });
  const originalFindUnique = prisma.eventReservation.findUnique;

  prisma.eventReservation.findUnique = async () => reservation;

  try {
    await assert.rejects(
      () =>
        receiveSixersCheck({
          reservationId: "res-1",
          checkNumber: "CHK-42",
          account: "FW",
          admin: {
            graphql: async () => ({
              json: async () => ({
                data: {
                  draftOrder: {
                    id: "gid://shopify/DraftOrder/123",
                    status: "OPEN",
                    totalPrice: "120.00",
                    customAttributes: [{ key: "Sixers Reservation ID", value: "res-1" }],
                    lineItems: {
                      nodes: [{ quantity: 2, variant: { id: "gid://shopify/ProductVariant/111" } }],
                    },
                  },
                },
              }),
            }),
          },
        }),
      /previously being processed|not enabled yet/i,
    );

    assert.equal(reservation.checkNumber, "CHK-42");
  } finally {
    prisma.eventReservation.findUnique = originalFindUnique;
  }
});

test("confirmSixersPaidReservation refuses a different order even when the reservation is already pending", async () => {
  const prismaClient = {
    eventReservation: {
      findUnique: async () => ({
        id: "res-1",
        status: "PENDING",
        paymentMethod: "CHECK",
        shopifyOrderId: "999",
        shopifyOrderNumber: "#999",
        checkNumber: "CHK-42",
        eventLocation: { studioCode: "FW" },
        ticketTier: { fwCheckVariantId: "111", pmCheckVariantId: "222" },
      }),
      updateMany: async () => ({ count: 0 }),
    },
  };

  await assert.rejects(
    () =>
      confirmSixersPaidReservation({
        reservationId: "res-1",
        shop: "ida-dance-store.myshopify.com",
        shopifyOrderId: "gid://shopify/Order/456",
        shopifyOrderNumber: "#456",
        checkNumber: "CHK-42",
        admin: {},
        prismaClient,
      }),
    /manual review required|not awaiting payment/i,
  );
});

test("verifySixersPaidOrderMatch rejects wrong store, wrong amount, wrong reservation ID, and wrong variant", async () => {
  const reservation = buildReservation({
    id: "res-1",
    eventLocation: { studioCode: "PM" },
    ticketTier: { event: { type: "TICKET_SALE" }, fwCheckVariantId: "111", pmCheckVariantId: "222" },
  });

  const goodOrder = { ...basePaidOrder, customAttributes: [{ key: "Sixers Reservation ID", value: "res-1" }] };

  await assert.rejects(
    () =>
      verifySixersPaidOrderMatch({
        reservation,
        shop: "ida-dance-store.myshopify.com",
        shopifyOrderId: "gid://shopify/Order/456",
        order: { ...goodOrder, customAttributes: [{ key: "Sixers Reservation ID", value: "wrong" }] },
      }),
    /store does not match|does not match this Sixers reservation/i,
  );

  await assert.rejects(
    () =>
      verifySixersPaidOrderMatch({
        reservation,
        shop: "ida-dance-store-pm.myshopify.com",
        shopifyOrderId: "gid://shopify/Order/456",
        order: { ...goodOrder, totalPriceSet: { shopMoney: { amount: "119.99", currencyCode: "USD" } } },
      }),
    /amount does not match|manual review required/i,
  );

  await assert.rejects(
    () =>
      verifySixersPaidOrderMatch({
        reservation,
        shop: "ida-dance-store-pm.myshopify.com",
        shopifyOrderId: "gid://shopify/Order/456",
        order: { ...goodOrder, lineItems: { nodes: [{ quantity: 1, variant: { id: "gid://shopify/ProductVariant/999" } }] } },
      }),
    /ticket tier.*quantity|does not match/i,
  );
});

test("confirmSixersPaidReservation is idempotent for repeated webhook delivery of the same paid order", async () => {
  const prismaClient = {
    eventReservation: {
      findUnique: async () => ({
        id: "res-1",
        status: "CONFIRMED",
        paymentMethod: "CHECK",
        shopifyOrderId: "456",
        shopifyOrderNumber: "#456",
      }),
    },
  };

  const result = await confirmSixersPaidReservation({
    reservationId: "res-1",
    shop: "ida-dance-store.myshopify.com",
    shopifyOrderId: "gid://shopify/Order/456",
    shopifyOrderNumber: "#456",
    admin: {},
    prismaClient,
  });

  assert.equal(result.success, true);
  assert.equal(result.alreadyConfirmed, true);
  assert.equal(result.shopifyOrderNumber, "#456");
});

test("reconcileSixersPaidCheck handles a PAID order for a PENDING reservation without charging or completing again", async () => {
  const reservation = buildReservation({
    status: "PENDING",
    shopifyDraftStatus: "COMPLETED",
    shopifyOrderId: null,
    shopifyOrderNumber: null,
  });

  const originalFindUnique = prisma.eventReservation.findUnique;

  prisma.eventReservation.findUnique = async () => reservation;

  try {
    const admin = {
      graphql: async (query, variables) => {
        if (query.includes("VerifySixersPaidOrder")) {
          return {
            json: async () => ({
              data: {
                order: {
                  ...basePaidOrder,
                  id: variables.id,
                },
              },
            }),
          };
        }

        return {
          json: async () => ({
            data: {
              draftOrder: {
                id: "gid://shopify/DraftOrder/123",
                order: { id: variables.id },
              },
            },
          }),
        };
      },
    };

    await assert.rejects(
      () =>
        reconcileSixersPaidCheck({
          reservationId: "res-1",
          shop: "ida-dance-store.myshopify.com",
          shopifyOrderId: "gid://shopify/Order/456",
          shopifyOrderNumber: "#456",
          checkNumber: "CHK-42",
          admin,
        }),
      /not enabled yet|manual review required|Shopify has not verified/i,
    );

    assert.equal(reservation.status, "PENDING");
    assert.equal(reservation.shopifyOrderId, null);
  } finally {
    prisma.eventReservation.findUnique = originalFindUnique;
  }
});
