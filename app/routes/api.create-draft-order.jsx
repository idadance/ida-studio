import { createDraftOrder } from "../services/draftOrders.server";
import { unauthenticated } from "../shopify.server";

export async function action({ request }) {
  try {
    const order = await request.json();

    const shop =
      order.account === "FW"
        ? "ida-dance-store.myshopify.com"
        : "ida-dance-store-pm.myshopify.com";

    console.log("Using shop:", shop);

    const { admin } = await unauthenticated.admin(shop);

console.log("✅ Authenticated successfully");

console.log("➡️ Calling createDraftOrder()");

const result = await createDraftOrder(
  admin,
  order,
);

console.log("✅ createDraftOrder finished");

return Response.json(result);
  } catch (err) {
    console.error("========== DRAFT ORDER ERROR ==========");

    if (err instanceof Response) {
  console.error("========== SHOPIFY RESPONSE ==========");
  console.error("Status:", err.status);

  const text = await err.text();

  console.error(text);

  return Response.json(
    {
      error: text || `Shopify returned ${err.status}`,
    },
    {
      status: err.status,
    },
  );
}

    if (err instanceof Error) {
      console.error(err.message);
      console.error(err.stack);
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