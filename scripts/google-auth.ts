import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import prisma from "../app/db.server";

async function main() {
  const auth = await authenticate({
    keyfilePath: "./oauth-client.json",
   scopes: [
  "https://www.googleapis.com/auth/drive",
],
  });

  const oauth2Client = auth as any;

  const refreshToken =
    oauth2Client.credentials.refresh_token;

  if (!refreshToken) {
    throw new Error(
      "No refresh token was returned by Google."
    );
  }

  await prisma.appSetting.upsert({
    where: {
      key: "google_refresh_token",
    },
    update: {
      value: refreshToken,
    },
    create: {
      key: "google_refresh_token",
      value: refreshToken,
    },
  });

  console.log("");
  console.log("==================================");
  console.log("GOOGLE AUTHENTICATION SUCCESSFUL");
  console.log("==================================");
  console.log("");
  console.log("✅ Refresh token saved to database.");
  console.log("");
}

main().catch(console.error);