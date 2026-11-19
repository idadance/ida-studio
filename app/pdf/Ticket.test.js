/* global globalThis */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { generateLiveTicketQRCode, generateQRCode } from "../services/qr.server";
import { generateTicketPDF } from "../services/ticketPdf.server";

const programUrl = "https://www.instituteofdanceartistry.com/programs/";
const ticket = {
  ticketCode: "sample-ticket-001",
  customerName: "Sample Customer",
  quantity: 1,
  performance: { organization: "GENERATIONS", name: "Generations Dance Concert", programUrl },
  show: { name: "Evening", date: new Date("2026-11-21T00:00:00Z") },
};

function useLocalLogos(t) {
  t.mock.method(globalThis, "fetch", async (input) => {
    const name = new URL(input).pathname.slice(1);
    assert(["generations-logo.png", "circle-logo.png"].includes(name));
    const image = await readFile(new URL(`../../public/${name}`, import.meta.url));
    return new Response(image);
  });
}

function withProgramUrl(programUrl) {
  return { ...ticket, performance: { ...ticket.performance, programUrl } };
}

function inspect(pdf) {
  const doc = pdf.toString("latin1");
  const streams = [...doc.matchAll(/\d+ 0 obj\n(<<[^]*?>>)\nstream\n([^]*?)\nendstream/g)];
  const images = streams.filter(([, dictionary]) => dictionary.includes("/Subtype /Image"));
  const text = streams
    .filter(([, dictionary]) => !dictionary.includes("/Subtype"))
    .flatMap(([, , data]) => [...inflateSync(Buffer.from(data, "latin1")).toString().matchAll(/\[([^\]\n]+)\] TJ/g)])
    .map(([, run]) => [...run.matchAll(/<([0-9a-f]+)>/gi)]
      .map(([, hex]) => Buffer.from(hex, "hex").toString("latin1")).join(""))
    .join("\n");
  return { doc, text, images: images.map(([, , data]) => data) };
}

test("Generations PDF displays a one-page program button linked to the performance URL", async (t) => {
  useLocalLogos(t);
  const qrCode = await generateLiveTicketQRCode(ticket.ticketCode);
  const pdf = await generateTicketPDF({ ticket, qrCode });
  const { doc, text } = inspect(pdf);
  assert.equal((doc.match(/\/Type \/Page\b/g) ?? []).length, 1);
  assert.equal((doc.match(/\/Subtype \/Link\b/g) ?? []).length, 1);
  assert(doc.includes(`/URI (${programUrl})`));
  assert.match(text, /VIEW DIGITAL PROGRAM/);
  assert.doesNotMatch(text, /OPEN LIVE TICKET|At the venue, tap/);
  assert.match(text, /Scan on Show Day\nfor Fast Entry/);

  const otherUrl = "https://example.test/another-performance?language=en#cast";
  const other = inspect(await generateTicketPDF({ ticket: withProgramUrl(otherUrl), qrCode }));
  assert(other.doc.includes(`/URI (${otherUrl})`));
  if (process.env.GENERATIONS_SAMPLE_PDF) {
    await writeFile(process.env.GENERATIONS_SAMPLE_PDF, pdf, { flag: "wx" });
  }
});

test("Black Box PDF does not use a configured program URL", async (t) => {
  useLocalLogos(t);
  const fixture = {
    ...ticket,
    performance: { organization: "IDA", name: "Black Box Theater", programUrl },
  };
  const qrCode = await generateLiveTicketQRCode(fixture.ticketCode);
  const { doc, text } = inspect(await generateTicketPDF({ ticket: fixture, qrCode }));
  assert.doesNotMatch(doc, /\/Subtype \/Link\b/);
  assert.doesNotMatch(text, /VIEW DIGITAL PROGRAM|OPEN LIVE TICKET/);
  assert.match(text, /Scan on Show Day\nfor Fast Entry/);
});

test("the button leaves the QR images from both existing generators unchanged", async (t) => {
  useLocalLogos(t);
  const liveQr = await generateLiveTicketQRCode(ticket.ticketCode);
  const checkInQr = await generateQRCode(ticket.ticketCode);
  assert.notEqual(liveQr, checkInQr);
  for (const qrCode of [liveQr, checkInQr]) {
    const original = inspect(await generateTicketPDF({ ticket: withProgramUrl(null), qrCode }));
    const updated = inspect(await generateTicketPDF({ ticket, qrCode }));
    assert(original.images.length >= 2);
    assert.deepEqual(updated.images, original.images);
  }
});

test("missing and invalid program URLs omit the button and retain the QR", async (t) => {
  useLocalLogos(t);
  const warn = t.mock.method(console, "warn", () => {});
  const qrCode = await generateLiveTicketQRCode(ticket.ticketCode);
  for (const url of [null, " ", "/programs/", "javascript:alert(1)", "https://user:pass@example.test"]) {
    const { doc, text, images } = inspect(await generateTicketPDF({ ticket: withProgramUrl(url), qrCode }));
    assert.doesNotMatch(doc, /\/Subtype \/Link\b/);
    assert.doesNotMatch(text, /VIEW DIGITAL PROGRAM|OPEN LIVE TICKET/);
    assert(images.length >= 2);
  }
  assert.equal(warn.mock.calls.length, 3);
});
