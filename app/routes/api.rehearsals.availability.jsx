import { json } from "@remix-run/node";

import {
  getTeacherByName,
} from "../services/teacher.server";

import {
  getTeacherAvailability,
} from "../services/teacherAvailability.server";

export async function loader({ request }) {
  const url = new URL(request.url);

  const teacherName =
    url.searchParams.get("teacher");

  if (!teacherName) {
    return json([]);
  }

  const teacher =
    await getTeacherByName(
      teacherName,
    );

  if (!teacher) {
    return json([]);
  }

  const availability =
    await getTeacherAvailability(
      teacher.id,
    );

  return json(availability);
}