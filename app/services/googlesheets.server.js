import { google } from "googleapis";
import { getGoogleAuth } from "./google.server";

async function getSheets() {
  const auth = await getGoogleAuth();

  return google.sheets({
    version: "v4",
    auth,
  });
}

export async function readSheet(
  spreadsheetId,
  range,
) {
  const sheets = await getSheets();

  const result =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

  return result.data.values ?? [];
}

export function getSpreadsheetId(sheetUrl) {
  const match = sheetUrl.match(
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/
  );

  if (!match) {
    throw new Error("Invalid Google Sheet URL.");
  }

  return match[1];
}

export async function readAvailabilitySheet(sheetUrl) {
  const spreadsheetId =
    getSpreadsheetId(sheetUrl);

  return readSheet(
    spreadsheetId,
    "'Solo/Duet Rehearsal Availability'!A1:Z200",
  );
}

export function parseAvailabilityRows(rows) {
  const availability = [];

  let startIndex = rows.findIndex(
    (row) => row[0] === "Rehearsal Availability",
  );

  if (startIndex === -1) {
    throw new Error(
      "Could not find Rehearsal Availability section.",
    );
  }

  // Skip the section title and header row
  startIndex += 2;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];

    if (!row.length) {
      continue;
    }

    const [
      day,
      date,
      available,
      timeSlot,
      preferredLocation,
      notes,
    ] = row;

    if (available !== "TRUE") {
      continue;
    }

    availability.push({
      day,
      date,
      timeSlot,
      preferredLocation:
        preferredLocation || "Either",
      notes: notes || "",
    });
  }

  return availability;
}