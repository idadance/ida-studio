import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  return Response.json(
    { error: "Method not allowed." },
    {
      status: 405,
      headers: corsHeaders,
    },
  );
}

export async function action({ request }) {
  try {
    const { image } = await request.json();

    if (!image) {
      return Response.json(
        { error: "No image was provided." },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
You are helping identify merchandise in a dance studio boutique.

Look carefully at the photographed item.

Your job is NOT to describe the item in detail.

Your job is to create a simple search phrase that is
likely to match a product in a Shopify catalog.

Return ONLY the search phrase. Nothing else.

Prioritize:
- general item type
- common dancewear terminology
- color only when useful

Use broad product categories whenever possible.

Examples:

pink leotard
black leotard
dance shorts
jazz shoes
ballet shoes
dance sneakers
leggings
tights
dance bag
dance top

IMPORTANT:
- NEVER include a brand name, even if a logo is visible.
- NEVER guess a size.
- NEVER include a price.
- NEVER include a SKU or barcode.
- Do not describe small visual details.
- Do not use words such as athletic, fashionable, women's, men's, or children's unless necessary to identify the product.
- Prefer a broad dance-store search term over a detailed description.

For example:

Instead of "black and white Adidas athletic sneakers"
return "dance sneakers".

Instead of "pink sleeveless girls ballet leotard"
return "pink leotard".

Instead of "black Capezio jazz shoes"
return "black jazz shoes".

Keep the answer between 1 and 4 words.
              `.trim(),
            },
            {
              type: "input_image",
              image_url: image,
            },
          ],
        },
      ],
    });

    const searchPhrase = response.output_text?.trim();

    if (!searchPhrase) {
      return Response.json(
        { error: "No description was returned." },
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    console.log("Photo identified as:", searchPhrase);

    return Response.json(
      {
        success: true,
        searchPhrase,
      },
      {
        headers: corsHeaders,
      },
    );
  } catch (error) {
    console.error("Photo identification error:", error);

    return Response.json(
      {
        error: "We couldn't identify that item. Please try again.",
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}