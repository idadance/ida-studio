import prisma from "../db.server";

const TEST_REHEARSAL_ID =
  "cmubjuzru0001vv3awfiqs7pf";

export async function loader() {
  try {
    const rehearsal =
      await prisma.soloDuetScheduledRehearsal.findUnique({
        where: {
          id: TEST_REHEARSAL_ID,
        },
      });

    if (!rehearsal) {
      return Response.json({
        success: true,
        message:
          "Temporary test rehearsal was already removed.",
      });
    }

    await prisma.soloDuetScheduledRehearsal.delete({
      where: {
        id: TEST_REHEARSAL_ID,
      },
    });

    return Response.json({
      success: true,
      message:
        "Temporary test rehearsal removed.",
      deletedRehearsalId:
        TEST_REHEARSAL_ID,
    });
  } catch (error) {
    console.error(
      "Test rehearsal cleanup failed:",
      error,
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown cleanup error",
      },
      {
        status: 500,
      },
    );
  }
}