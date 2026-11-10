import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  listSixersChecksForQueue,
  receiveSixersCheckFromQueue,
} from "./queue.server.js";

function makeSixersReservation({
  id,
  studioCode,
  customerName,
  customerEmail,
  status = "PENDING",
  paymentMethod = "CHECK",
}) {
  return {
    id,
    customerName,
    customerEmail,
    paymentMethod,
    status,
    quantity: 2,
    totalAmount: 120,
    eventLocation: {
      studioCode,
      event: { name: "Sixers Gala" },
      name: "Arena A",
    },
    ticketTier: { name: "Lower Bowl" },
    shopifyOrderNumber: `#${id}`,
  };
}

function runQueueRouteHarness({ state, request, mode }) {
  const tempRoot = mkdtempSync(join(tmpdir(), "ida-queue-route-"));
  const appDir = join(tempRoot, "app");
  const servicesDir = join(appDir, "services");
  const routesDir = join(appDir, "routes");

  mkdirSync(servicesDir, { recursive: true });
  mkdirSync(routesDir, { recursive: true });

  const nodeModulesDir = join(tempRoot, "node_modules");
  mkdirSync(nodeModulesDir, { recursive: true });
  writeFileSync(join(tempRoot, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  symlinkSync(join(process.cwd(), "node_modules", "react"), join(nodeModulesDir, "react"));
  symlinkSync(join(process.cwd(), "node_modules", "react-router"), join(nodeModulesDir, "react-router"));

  const queueRouteSource = readFileSync(
    new URL("../routes/app.queue.jsx", import.meta.url),
    "utf8",
  );

  writeFileSync(join(routesDir, "app.queue.jsx"), queueRouteSource);

  writeFileSync(
    join(appDir, "db.server.js"),
    `
      globalThis.__QUEUE_TEST_STATE__ ??= {};
      const prisma = {
        eventReservation: {
          findMany: async ({ where }) => {
            const rows = globalThis.__QUEUE_TEST_STATE__.reservations ?? [];
            if (where?.paymentMethod === "CHECK" && where?.status === "PENDING") {
              return rows.filter((reservation) => {
                const sameStudio = reservation.eventLocation?.studioCode === where.eventLocation?.studioCode;
                return reservation.paymentMethod === "CHECK" && reservation.status === "PENDING" && sameStudio;
              });
            }
            return rows;
          },
        },
        soloDuetRegistration: { findMany: async () => [] },
        photoOrder: { findMany: async () => [] },
        performance: { findMany: async () => [] },
        event: { findMany: async () => [] },
      };
      export default prisma;
    `,
  );

  writeFileSync(
    join(appDir, "shopify.server.js"),
    `
      globalThis.__QUEUE_TEST_STATE__ ??= {};
      export const authenticate = {
        admin: async () => ({
          session: { shop: globalThis.__QUEUE_TEST_STATE__.shop },
          admin: globalThis.__QUEUE_TEST_STATE__.admin,
        }),
      };
    `,
  );

  writeFileSync(
    join(servicesDir, "productionDashboard.server.js"),
    `
      export async function getWaitingForCheckQueue() {
        return globalThis.__QUEUE_TEST_STATE__.waiting ?? [];
      }
    `,
  );

  writeFileSync(
    join(servicesDir, "queue.server.js"),
    `
      globalThis.__QUEUE_TEST_STATE__ ??= {};

      export async function listSixersChecksForQueue({ account }) {
        return (globalThis.__QUEUE_TEST_STATE__.reservations ?? []).filter((reservation) => {
          return (
            reservation.paymentMethod === "CHECK" &&
            reservation.status === "PENDING" &&
            reservation.eventLocation?.studioCode === account
          );
        });
      }

      export async function receiveSixersCheckFromQueue({ reservationId, checkNumber, account, admin }) {
        const calls = globalThis.__QUEUE_TEST_STATE__.calls ?? [];
        calls.push({ type: "sixers", reservationId, checkNumber, account, admin });
        globalThis.__QUEUE_TEST_STATE__.calls = calls;

        if (globalThis.__QUEUE_TEST_STATE__.flagOff) {
          throw new Error("Sixers check receipt is not enabled yet. No Shopify payment was processed.");
        }

        globalThis.__QUEUE_TEST_STATE__.reservations = (globalThis.__QUEUE_TEST_STATE__.reservations ?? []).filter(
          (reservation) => reservation.id !== reservationId,
        );

        return { success: true };
      }

      export async function receiveSoloDuetCheck({ registrationId, checkNumber, account, admin }) {
        const calls = globalThis.__QUEUE_TEST_STATE__.calls ?? [];
        calls.push({ type: "solo-duet", registrationId, checkNumber, account, admin });
        globalThis.__QUEUE_TEST_STATE__.calls = calls;
        return { success: true };
      }

      export async function receivePhotoCheck({ photoOrderId, checkNumber, account, admin }) {
        const calls = globalThis.__QUEUE_TEST_STATE__.calls ?? [];
        calls.push({ type: "photo", photoOrderId, checkNumber, account, admin });
        globalThis.__QUEUE_TEST_STATE__.calls = calls;
        return { success: true };
      }

      export async function receiveEventCheck({ reservationId, admin, account }) {
        const calls = globalThis.__QUEUE_TEST_STATE__.calls ?? [];
        calls.push({ type: "event", reservationId, account, admin });
        globalThis.__QUEUE_TEST_STATE__.calls = calls;
        return { success: true };
      }

      export async function receiveCheck({ reservationId, showId, checkNumber, admin, account }) {
        const calls = globalThis.__QUEUE_TEST_STATE__.calls ?? [];
        calls.push({ type: "generic", reservationId, showId, checkNumber, account, admin });
        globalThis.__QUEUE_TEST_STATE__.calls = calls;
        return { success: true };
      }
    `,
  );

  const routeUrl = join(routesDir, "app.queue.jsx");
  const scriptPath = join(tempRoot, "harness.mjs");
  const script = `
    import { pathToFileURL } from "node:url";

    globalThis.__QUEUE_TEST_STATE__ = ${JSON.stringify(state)};
    const routeModule = await import(pathToFileURL(${JSON.stringify(routeUrl)}).href + "?route-run");

    const requestInit = ${JSON.stringify(request.init ?? {})};
    if (requestInit.method === "POST" && requestInit.body && !requestInit.headers) {
      requestInit.headers = { "Content-Type": "application/x-www-form-urlencoded" };
    }
    const request = new Request(${JSON.stringify(request.url)}, requestInit);
    if (${JSON.stringify(mode)} === "loader") {
      const result = await routeModule.loader({ request });
      console.log(JSON.stringify(result));
    } else if (${JSON.stringify(mode)} === "action+loader") {
      const actionResult = await routeModule.action({ request });
      const loaderResult = await routeModule.loader({
        request: new Request("https://example.com/app/queue?sixers=true"),
      });
      console.log(JSON.stringify({
        action: {
          ok: true,
          location: actionResult?.headers?.get ? actionResult.headers.get("Location") : actionResult?.url ?? null,
          calls: globalThis.__QUEUE_TEST_STATE__.calls ?? [],
        },
        loader: loaderResult,
      }));
    } else {
      try {
        const result = await routeModule.action({ request });
        const payload = {
          ok: true,
          location: result?.headers?.get ? result.headers.get("Location") : result?.url ?? null,
          calls: globalThis.__QUEUE_TEST_STATE__.calls ?? [],
        };
        console.log(JSON.stringify(payload));
      } catch (error) {
        console.log(JSON.stringify({ ok: false, error: error.message }));
      }
    }
  `;

  writeFileSync(scriptPath, script);

  const output = execFileSync("npx", ["tsx", scriptPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  return JSON.parse(output.trim());
}

test("listSixersChecksForQueue includes only pending Sixers check reservations for the matching studio", async () => {
  const prismaClient = {
    eventReservation: {
      findMany: async ({ where }) => {
        assert.equal(where.paymentMethod, "CHECK");
        assert.equal(where.status, "PENDING");
        assert.equal(where.eventLocation.studioCode, "FW");

        return [
          {
            id: "res-1",
            customerName: "Jamie Smith",
            customerEmail: "jamie@example.com",
            quantity: 2,
            totalAmount: 90,
            eventLocation: { studioCode: "FW", event: { name: "Sixers Gala" } },
          },
          {
            id: "res-2",
            customerName: "Other Studio",
            customerEmail: "other@example.com",
            quantity: 1,
            totalAmount: 45,
            eventLocation: { studioCode: "PM", event: { name: "Other Event" } },
          },
        ];
      },
    },
  };

  const reservations = await listSixersChecksForQueue({
    account: "FW",
    prismaClient,
  });

  assert.equal(reservations.length, 2);
  assert.equal(reservations[0].customerName, "Jamie Smith");
  assert.equal(reservations[1].eventLocation.studioCode, "PM");
});

test("receiveSixersCheckFromQueue enforces the queue check-number guard before invoking the payment flow", async () => {
  await assert.rejects(
    () =>
      receiveSixersCheckFromQueue({
        reservationId: "res-1",
        checkNumber: "   ",
        account: "FW",
        admin: { graphql: async () => ({ json: async () => ({}) }) },
      }),
    /Check number is required/i,
  );

  await assert.rejects(
    () =>
      receiveSixersCheckFromQueue({
        reservationId: "res-1",
        checkNumber: "CHK-42",
        account: "INVALID",
        admin: { graphql: async () => ({ json: async () => ({}) }) },
      }),
    /Invalid studio account/i,
  );
});

test("loader shows only the matching studio's pending Sixers CHECK reservations in the queue", async () => {
  const state = {
    shop: "ida-dance-store.myshopify.com",
    admin: { graphql: async () => ({ json: async () => ({ data: {} }) }) },
    waiting: [],
    reservations: [
      makeSixersReservation({ id: "fw-1", studioCode: "FW", customerName: "FW Customer" }),
      makeSixersReservation({ id: "pm-1", studioCode: "PM", customerName: "PM Customer" }),
      makeSixersReservation({ id: "fw-2", studioCode: "FW", customerName: "FW Confirmed", status: "CONFIRMED" }),
    ],
  };

  const fwData = runQueueRouteHarness({
    state,
    mode: "loader",
    request: {
      url: "https://example.com/app/queue?sixers=true",
      init: undefined,
    },
  });

  assert.equal(fwData.sixersChecks.length, 1);
  assert.equal(fwData.sixersChecks[0].id, "fw-1");
  assert.equal(fwData.sixersChecks[0].eventLocation.studioCode, "FW");

  const pmState = { ...state, shop: "ida-dance-store-pm.myshopify.com" };
  const pmData = runQueueRouteHarness({
    state: pmState,
    mode: "loader",
    request: {
      url: "https://example.com/app/queue?sixers=true",
      init: undefined,
    },
  });

  assert.equal(pmData.sixersChecks.length, 1);
  assert.equal(pmData.sixersChecks[0].id, "pm-1");
  assert.equal(pmData.sixersChecks[0].eventLocation.studioCode, "PM");
});

test("action dispatches Receive Check to the Sixers service with the correct reservation, studio, and check number", async () => {
  const state = {
    shop: "ida-dance-store.myshopify.com",
    admin: { graphql: async () => ({ json: async () => ({ data: {} }) }) },
    waiting: [],
    flagOff: false,
    reservations: [
      makeSixersReservation({ id: "fw-1", studioCode: "FW", customerName: "FW Customer" }),
    ],
    calls: [],
  };

  const result = runQueueRouteHarness({
    state,
    mode: "action",
    request: {
      url: "https://example.com/app/queue",
      init: {
        method: "POST",
        body: new URLSearchParams({
          reservationType: "sixers",
          reservationId: "fw-1",
          checkNumber: "CHK-42",
        }).toString(),
      },
    },
  });

  assert.equal(result.location, "/app/queue?sixers=true");

  const sixersCall = result.calls.at(-1);
  assert.equal(sixersCall.type, "sixers");
  assert.equal(sixersCall.reservationId, "fw-1");
  assert.equal(sixersCall.checkNumber, "CHK-42");
  assert.equal(sixersCall.account, "FW");
  assert.ok(sixersCall.admin && typeof sixersCall.admin === "object");
});

test("action fails safely when ENABLE_SIXERS_CHECK_PAYMENTS is off", async () => {
  const state = {
    shop: "ida-dance-store.myshopify.com",
    admin: { graphql: async () => ({ json: async () => ({ data: {} }) }) },
    waiting: [],
    flagOff: true,
    reservations: [
      makeSixersReservation({ id: "fw-1", studioCode: "FW", customerName: "FW Customer" }),
    ],
    calls: [],
  };

  const result = runQueueRouteHarness({
    state,
    mode: "action",
    request: {
      url: "https://example.com/app/queue",
      init: {
        method: "POST",
        body: new URLSearchParams({
          reservationType: "sixers",
          reservationId: "fw-1",
          checkNumber: "CHK-42",
        }).toString(),
      },
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /Sixers check receipt is not enabled yet/i);
});

test("successful confirmation removes the reservation from the queue on the next load", async () => {
  const state = {
    shop: "ida-dance-store.myshopify.com",
    admin: { graphql: async () => ({ json: async () => ({ data: {} }) }) },
    waiting: [],
    flagOff: false,
    reservations: [
      makeSixersReservation({ id: "fw-1", studioCode: "FW", customerName: "FW Customer" }),
    ],
    calls: [],
  };

  const result = runQueueRouteHarness({
    state,
    mode: "action+loader",
    request: {
      url: "https://example.com/app/queue",
      init: {
        method: "POST",
        body: new URLSearchParams({
          reservationType: "sixers",
          reservationId: "fw-1",
          checkNumber: "CHK-42",
        }).toString(),
      },
    },
  });

  assert.equal(result.action.ok, true);
  assert.deepEqual(result.loader.sixersChecks, []);
});

test("other queue actions still dispatch to the correct type-specific handlers", async () => {
  const state = {
    shop: "ida-dance-store.myshopify.com",
    admin: { graphql: async () => ({ json: async () => ({ data: {} }) }) },
    waiting: [],
    reservations: [],
    calls: [],
  };

  const soloResult = runQueueRouteHarness({
    state,
    mode: "action",
    request: {
      url: "https://example.com/app/queue",
      init: {
        method: "POST",
        body: new URLSearchParams({
          reservationType: "solo-duet",
          reservationId: "reg-1",
          checkNumber: "CHK-X",
        }).toString(),
      },
    },
  });

  const photoResult = runQueueRouteHarness({
    state,
    mode: "action",
    request: {
      url: "https://example.com/app/queue",
      init: {
        method: "POST",
        body: new URLSearchParams({
          reservationType: "photo",
          reservationId: "photo-1",
          checkNumber: "CHK-P",
        }).toString(),
      },
    },
  });

  const eventResult = runQueueRouteHarness({
    state,
    mode: "action",
    request: {
      url: "https://example.com/app/queue",
      init: {
        method: "POST",
        body: new URLSearchParams({
          reservationType: "event",
          reservationId: "event-1",
          eventId: "evt-1",
        }).toString(),
      },
    },
  });

  assert.deepEqual(
    [soloResult.calls.at(-1)?.type, photoResult.calls.at(-1)?.type, eventResult.calls.at(-1)?.type],
    ["solo-duet", "photo", "event"],
  );
});
