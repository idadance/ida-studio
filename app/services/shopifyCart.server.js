import { authenticate } from "../shopify.server";

export async function createCart({
  request,
  lines,
}) {
  const { storefront, session } =
  await authenticate.public.appProxy(request);

if (!storefront) {
  throw new Error(
    "App Proxy authentication failed. Is the app installed on this shop?",
  );
}

  const response = await storefront.graphql(
    `#graphql
      mutation CreateCart($lines: [CartLineInput!]!) {
        cartCreate(input: { lines: $lines }) {
          cart {
            id
            checkoutUrl
          }

          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        lines,
      },
    },
  );

  const json = await response.json();

  const result = json.data.cartCreate;

  if (result.userErrors.length) {
    throw new Error(result.userErrors[0].message);
  }

  return result.cart;
}

export async function buildCartLines({
  show,
  quantity,
  includeVideo,
  paymentMethod,
}) {
  const ticketVariantId =
    paymentMethod === "CREDIT_CARD"
      ? show.shopifyCreditTicketVariantId
      : show.shopifyCheckTicketVariantId;

  if (!ticketVariantId) {
    throw new Error(
      "This show does not have the correct Ticket Variant configured.",
    );
  }

  const lines = [
    {
      merchandiseId: ticketVariantId,
      quantity,
    },
  ];

  const videoVariantId =
    paymentMethod === "CREDIT_CARD"
      ? show.shopifyCreditVideoVariantId
      : show.shopifyCheckVideoVariantId;

  if (includeVideo && videoVariantId) {
    lines.push({
      merchandiseId: videoVariantId,
      quantity: 1,
    });
  }

  return lines;
}