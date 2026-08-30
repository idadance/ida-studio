import { redirect } from "react-router";
import crypto from "node:crypto";

import {
  googleAuth,
  GOOGLE_SCOPES,
} from "../services/googleAuth.server";

export async function loader() {
  const state = crypto.randomUUID();

  const url = googleAuth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state,
  });

  throw redirect(url);
}

export default function GoogleConnect() {
  return null;
}