import { google } from "googleapis";
import prisma from "../db.server";

export async function getGoogleAuth() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: "google_refresh_token",
    },
  });

  if (!setting) {
    throw new Error(
      "Google has not been connected.",
    );
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  auth.setCredentials({
    refresh_token: setting.value,
  });

  return auth;
}