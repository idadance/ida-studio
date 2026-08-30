import { redirect } from "react-router";

export async function loader() {
  // We'll replace this URL with the real OAuth URL next.
  throw redirect("/app/settings");
}

export default function GoogleConnect() {
  return null;
}