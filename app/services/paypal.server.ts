type PayPalEnvironment = "sandbox" | "live";

function getPayPalEnvironment(): PayPalEnvironment {
  return process.env.PAYPAL_ENVIRONMENT === "live"
    ? "live"
    : "sandbox";
}

function getPayPalBaseUrl() {
  return getPayPalEnvironment() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function getPayPalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret =
    process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal credentials are not configured.",
    );
  }

  return {
    clientId,
    clientSecret,
  };
}

async function getPayPalAccessToken() {
  const { clientId, clientSecret } =
    getPayPalCredentials();

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`,
  ).toString("base64");

  const response = await fetch(
    `${getPayPalBaseUrl()}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(
      "PayPal access token error:",
      data,
    );

    throw new Error(
      "Unable to authenticate with PayPal.",
    );
  }

  return data.access_token as string;
}

export async function createPayPalOrder({
  amount,
  description,
}: {
  amount: number;
  description: string;
}) {
  const accessToken =
    await getPayPalAccessToken();

  const response = await fetch(
    `${getPayPalBaseUrl()}/v2/checkout/orders`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",

        purchase_units: [
          {
            description,

            amount: {
              currency_code: "USD",
              value: amount.toFixed(2),
            },
          },
        ],
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(
      "PayPal create order error:",
      data,
    );

    throw new Error(
      "Unable to create PayPal order.",
    );
  }

  return data;
}

export async function capturePayPalOrder(
  paypalOrderId: string,
) {
  const accessToken =
    await getPayPalAccessToken();

  const response = await fetch(
    `${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(
      paypalOrderId,
    )}/capture`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json",
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(
      "PayPal capture order error:",
      data,
    );

    throw new Error(
      "Unable to capture PayPal order.",
    );
  }

  return data;
}