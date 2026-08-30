import { google } from "googleapis";

const APP_URL =
  process.env.SHOPIFY_APP_URL!;

export const googleAuth =
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${APP_URL}/google/callback`,
  );

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
];