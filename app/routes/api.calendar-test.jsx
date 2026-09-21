import {
  checkTeacherSchedulingConflict,
} from "../services/rehearsalScheduling.server.js";

const TEACHER_ID =
  "cmtnqddcw0000u33aowrldaof";

export async function loader() {
  try {
    const tests = [
      {
        name:
          "3:00 PM FW — same location, back-to-back",
        start:
          "2026-11-07T15:00:00-05:00",
        end:
          "2026-11-07T16:00:00-05:00",
        location: "FW",
        expected: true,
      },

      {
        name:
          "3:00 PM PM — no travel time",
        start:
          "2026-11-07T15:00:00-05:00",
        end:
          "2026-11-07T16:00:00-05:00",
        location: "PM",
        expected: false,
      },

      {
        name:
          "3:15 PM PM — only 15 minutes travel",
        start:
          "2026-11-07T15:15:00-05:00",
        end:
          "2026-11-07T16:15:00-05:00",
        location: "PM",
        expected: false,
      },

      {
        name:
          "3:30 PM PM — full 30 minutes travel",
        start:
          "2026-11-07T15:30:00-05:00",
        end:
          "2026-11-07T16:30:00-05:00",
        location: "PM",
        expected: true,
      },
    ];

    const results = [];

    for (const test of tests) {
      const result =
        await checkTeacherSchedulingConflict(
          TEACHER_ID,
          test.start,
          test.end,
          test.location,
        );

      results.push({
        name: test.name,
        expectedAvailable:
          test.expected,
        actualAvailable:
          result.available,
        reason: result.reason,
        passed:
          result.available ===
          test.expected,
      });
    }

    return Response.json({
      success: true,
      existingRehearsal:
        "Amy — Nov 7, 2:00–3:00 PM — FW",
      allPassed:
        results.every(
          (result) => result.passed,
        ),
      results,
    });
  } catch (error) {
    console.error(
      "Travel rule test failed:",
      error,
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown travel rule test error",
      },
      {
        status: 500,
      },
    );
  }
}