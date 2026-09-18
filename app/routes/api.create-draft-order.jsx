import { createDraftOrder } from "../services/draftOrders.server";
import { unauthenticated } from "../shopify.server";

export async function action({ request }) {
  let shop = "";

  try {
    const order = await request.json();

    shop =
      order.account === "FW"
        ? "ida-dance-store.myshopify.com"
        : "ida-dance-store-pm.myshopify.com";

    console.log("Using shop:", shop);

    const { admin } =
      await unauthenticated.admin(shop);

    console.log(
      "✅ Authenticated successfully",
    );

    console.log(
      "➡️ Calling createDraftOrder()",
    );

    const result =
      await createDraftOrder(
        admin,
        order,
      );

    console.log(
      "✅ createDraftOrder finished",
    );

    return Response.json(result);
  } catch (err) {
    console.error(
      "========== DRAFT ORDER ERROR ==========",
    );

    if (err instanceof Response) {
      console.error(
        "========== SHOPIFY RESPONSE ==========",
      );

      console.error(
        "Status:",
        err.status,
      );

      console.error(
        "Status Text:",
        err.statusText,
      );

      console.error(
        "Headers:",
        Object.fromEntries(
          err.headers.entries(),
        ),
      );

      const text =
        await err.text();

      console.error(
        "Response Body:",
        text || "(empty)",
      );

      console.error(
        "Shop being authenticated:",
        shop,
      );

      return Response.json(
        {
          error:
            text ||
            `Shopify authentication returned ${err.status}`,
        },
        {
          status: err.status,
        },
      );
    }

    if (err instanceof Error) {
      console.error(
        "Error name:",
        err.name,
      );

      console.error(
        "Error message:",
        err.message,
      );

      console.error(
        "Error stack:",
        err.stack,
      );

      console.error(
        "Shop being authenticated:",
        shop,
      );
    } else {
      console.error(err);
    }

    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}