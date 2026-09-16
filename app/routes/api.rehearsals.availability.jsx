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
    return Response.json([]);
  }

  const teacher =
    await getTeacherByName(
      teacherName,
    );

  if (!teacher) {
    return Response.json([]);
  }

  const availability =
    await getTeacherAvailability(
      teacher.id,
    );

  return Response.json(availability);
}