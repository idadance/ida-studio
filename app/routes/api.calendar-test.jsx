import {
  getAvailableStudios,
} from "../services/calendar.server.js";

export async function loader() {
  try {
    const results =
      await getAvailableStudios(
        "2026-09-26T14:00:00-04:00",
        "2026-09-26T15:00:00-04:00",
      );

    return Response.json({
      success: true,
      requestedTime: {
        start:
          "2026-09-26T14:00:00-04:00",
        end:
          "2026-09-26T15:00:00-04:00",
      },
      studios: results,
    });
  } catch (error) {
    console.error(
      "Studio availability test failed:",
      error,
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown calendar error",
      },
      {
        status: 500,
      },
    );
  }
}