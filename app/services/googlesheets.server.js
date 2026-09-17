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
  "'Solo/Duet Rehearsal Availability'!A:Z",
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

    console.log(
  i,
  JSON.stringify(row),
);

    if (available !== "TRUE") {
      continue;
    }

    const cleanedDate =
  date.replace(/(st|nd|rd|th)/g, "") + ", 2026";

const sortDate = new Date(cleanedDate);

console.log({
  originalDate: date,
  cleanedDate,
  sortDate: sortDate.toString(),
  valid: !isNaN(sortDate.getTime()),
});

availability.push({
  day,
  date,
  sortDate,
  timeSlot,
  preferredLocation:
    preferredLocation || "Either",
  notes: notes || "",
});
  }

  console.log(
  "Finished parsing at row:",
  rows.length - 1,
);

  return availability;
}