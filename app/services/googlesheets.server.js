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