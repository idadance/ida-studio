import "@shopify/ui-extensions/preact";
import {render} from "preact";
import {useEffect, useRef, useState} from "preact/hooks";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const [status, setStatus] = useState("");
  const [cart, setCart] = useState(shopify.cart.current.value);
  const [busy, setBusy] = useState(false);

  // Manual product search
  const [searchMode, setSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Variant selection
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variants, setVariants] = useState([]);

  const lastScan = useRef("");

  useEffect(() => {
    const unsubscribeCart = shopify.cart.current.subscribe(
      (newCart) => {
        setCart(newCart);
      },
    );

    const unsubscribeScanner =
      shopify.scanner.scannerData.current.subscribe((data) => {
        if (!data?.data) return;

        const scannedBarcode = data.data;

        if (scannedBarcode === lastScan.current) return;

        lastScan.current = scannedBarcode;

        shopify.scanner.hideCameraScanner();
        findProduct(scannedBarcode);
      });

    return () => {
      unsubscribeCart();
      unsubscribeScanner();
    };
  }, []);

  async function findProduct(scannedBarcode) {
    setBusy(true);
    setStatus("Finding your item...");

    try {
      const response = await fetch(
        "shopify:admin/api/graphql.json",
        {
          method: "POST",
          body: JSON.stringify({
            query: `
              query FindVariant($query: String!) {
                productVariants(first: 1, query: $query) {
                  nodes {
                    id
                    title
                    barcode
                    price
                    product {
                      title
                    }
                  }
                }
              }
            `,
            variables: {
              query: `barcode:${scannedBarcode}`,
            },
          }),
        },
      );

      const result = await response.json();

      if (result.errors) {
        setStatus(
          "We couldn't look up that item. Please try again.",
        );
        return;
      }

      const variant =
        result?.data?.productVariants?.nodes?.[0];

      if (!variant) {
        setStatus("We couldn't find that item.");
        return;
      }

      const variantId = Number(
        variant.id.split("/").pop(),
      );

      await shopify.cart.addLineItem(variantId, 1);

      setStatus(`✓ ${variant.product.title} added!`);
    } catch (error) {
      console.error(error);

      setStatus(
        "Something went wrong. Please try scanning again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function searchProducts(event) {
    const searchText =
      event.currentTarget.value.trim();

    if (!searchText) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setStatus("");

    try {
      const results =
        await shopify.productSearch.searchProducts({
          queryString: searchText,
          first: 10,
        });

      setSearchResults(results.items ?? []);
    } catch (error) {
      console.error(error);

      setSearchResults([]);
      setStatus("We couldn't search for products.");
    } finally {
      setSearching(false);
    }
  }

  async function chooseProduct(product) {
    setSearching(true);
    setStatus("");

    try {
      const result =
        await shopify.productSearch
          .fetchPaginatedProductVariantsWithProductId(
            product.id,
            {first: 50},
          );

      const productVariants = result.items ?? [];

      if (productVariants.length === 0) {
        setStatus(
          "No available options were found for this item.",
        );
        return;
      }

      // Only one option: add it immediately.
      if (productVariants.length === 1) {
        await shopify.cart.addLineItem(
          productVariants[0].id,
          1,
        );

        setSearchMode(false);
        setSearchResults([]);
        setSelectedProduct(null);
        setVariants([]);

        setStatus(`✓ ${product.title} added!`);
        return;
      }

      // Multiple sizes/colors/etc.
      setSelectedProduct(product);
      setVariants(productVariants);

    } catch (error) {
      console.error(error);

      setStatus(
        "We couldn't open that product. Please try again.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function chooseVariant(variant) {
    setBusy(true);
    setStatus("");

    try {
      await shopify.cart.addLineItem(
        variant.id,
        1,
      );

      const productTitle =
        selectedProduct?.title || "Item";

      setSelectedProduct(null);
      setVariants([]);
      setSearchMode(false);
      setSearchResults([]);

      setStatus(`✓ ${productTitle} added!`);
    } catch (error) {
      console.error(error);

      setStatus(
        "We couldn't add that option. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function backToSearch() {
    setSelectedProduct(null);
    setVariants([]);
    setStatus("");
  }

  async function removeOne(item) {
    setBusy(true);

    try {
      if (item.quantity <= 1) {
        await shopify.cart.removeLineItem(item.uuid);
      } else {
        await shopify.cart.removeLineItem(item.uuid);

        await shopify.cart.addLineItem(
          item.variantId,
          item.quantity - 1,
        );
      }

      setStatus("");
    } catch (error) {
      console.error(error);

      setStatus(
        "We couldn't remove that item. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addOne(item) {
    setBusy(true);

    try {
      await shopify.cart.addLineItem(
        item.variantId,
        1,
      );

      setStatus("");
    } catch (error) {
      console.error(error);

      setStatus(
        "We couldn't add another item. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function startOver() {
    setBusy(true);

    try {
      await shopify.cart.clearCart();

      lastScan.current = "";
      setStatus("");
      setSearchMode(false);
      setSearchResults([]);
      setSelectedProduct(null);
      setVariants([]);
    } catch (error) {
      console.error(error);

      setStatus(
        "We couldn't clear the cart. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function scanItem() {
    lastScan.current = "";
    setStatus("");
    setSearchMode(false);
    setSelectedProduct(null);
    setVariants([]);

    shopify.scanner.showCameraScanner();
  }

 async function takePhoto() {
  setBusy(true);
  setStatus("");

  try {
    setStatus("Opening camera...");

    const photo = await shopify.camera.takePhoto({
      facingMode: "environment",
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
    });

    if (!photo?.base64) {
      setStatus("");
      return;
    }

    setStatus("Looking for your item...");

    const imageData = `data:${
      photo.type || "image/jpeg"
    };base64,${photo.base64}`;

    const response = await fetch(
      "https://whale-app-moapa.ondigitalocean.app/api/identify-product",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageData,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Photo identification failed.",
      );
    }

    console.log(
  "AI search phrase:",
  result.searchPhrase,
);

setStatus("Searching our Boutique...");

const matches =
  await shopify.productSearch.searchProducts({
    queryString: result.searchPhrase,
    first: 5,
  });

const matchedProducts = matches.items ?? [];

if (matchedProducts.length === 0) {
  setStatus(
    `We think this is: ${result.searchPhrase}. We couldn't find a matching Boutique item.`,
  );
  setSearchResults([]);
  return;
}

setSearchResults(matchedProducts);
setSearchMode(true);
setStatus("Is this your item?");

  } catch (error) {
    console.error(
      "Photo identification error:",
      error,
    );

    setStatus(
      "We couldn't identify that item. Please try again.",
    );
  } finally {
    setBusy(false);
  }
}
  function openSearch() {
    setStatus("");
    setSearchResults([]);
    setSelectedProduct(null);
    setVariants([]);
    setSearchMode(true);
  }

  function closeSearch() {
    setStatus("");
    setSearchResults([]);
    setSelectedProduct(null);
    setVariants([]);
    setSearchMode(false);
  }

  const items = cart?.lineItems ?? [];
  const hasItems = items.length > 0;

  function formatMoney(value) {
    const amount = Number(value);

    if (Number.isNaN(amount)) {
      return value || "$0.00";
    }

    return `$${amount.toFixed(2)}`;
  }

  return (
    <s-page heading="IDA Boutique">
      <s-scroll-box>

        {/* IDA BOUTIQUE HEADER */}
        <s-box
          inlineSize="100%"
          blockSize="105px"
        >
          <s-image
            src="https://cdn.shopify.com/s/files/1/0765/8743/4158/files/ida-boutique-header_0be3032f-3040-4a46-80a1-af2f7c40df63.png?v=1787933052"
            alt="IDA Boutique Self Checkout"
            inlineSize="fill"
            objectFit="cover"
          />
        </s-box>

        {/* VARIANT SELECTION */}
        {selectedProduct ? (
          <s-box padding="large">

            <s-heading>CHOOSE AN OPTION</s-heading>

            <s-box paddingBlock="small">
              <s-heading>
                {selectedProduct.title}
              </s-heading>
            </s-box>

            <s-box paddingBlockEnd="base">
              <s-text>
                Choose the size or option you want.
              </s-text>
            </s-box>

            <s-stack direction="block" gap="base">

  {variants.map((variant) => (
    <s-button
      key={variant.id}
      variant="secondary"
      disabled={busy}
      onClick={() => chooseVariant(variant)}
    >
      {variant.title}
    </s-button>
  ))}

  {status ? (
    <s-text>{status}</s-text>
  ) : null}

  <s-divider />

  <s-button
    variant="secondary"
    onClick={backToSearch}
  >
    ← Back to Search
  </s-button>

</s-stack>

          </s-box>

        ) : searchMode ? (

          /* FIND MY ITEM */
          <s-box padding="large">

            <s-heading>FIND MY ITEM</s-heading>

            <s-box paddingBlock="small">
              <s-text>
                Type the name of the item you're looking for.
              </s-text>
            </s-box>

            <s-search-field
              placeholder="Search products"
              onInput={searchProducts}
            />

            {searching ? (
              <s-box paddingBlock="base">
                <s-text>Searching...</s-text>
              </s-box>
            ) : null}

            {searchResults.map((product) => (
              <s-box
                key={product.id}
                paddingBlock="small"
              >
                <s-button
                  variant="secondary"
                  disabled={searching}
                  onClick={() =>
                    chooseProduct(product)
                  }
                >
                  {product.title}
                </s-button>
              </s-box>
            ))}

            {status ? (
              <s-box paddingBlock="base">
                <s-text>{status}</s-text>
              </s-box>
            ) : null}

            <s-box paddingBlockStart="base">
              <s-button
                variant="secondary"
                onClick={closeSearch}
              >
                ← Back
              </s-button>
            </s-box>

          </s-box>

        ) : !hasItems ? (

          /* READY TO SHOP */
          <s-box padding="large">

            <s-heading>Ready to shop?</s-heading>

            <s-box paddingBlock="small">
              <s-text>
                Scan the barcode on your first item.
              </s-text>
            </s-box>

            <s-box paddingBlock="base">
              <s-button
                variant="primary"
                loading={busy}
                onClick={scanItem}
              >
                SCAN ITEM
              </s-button>
            </s-box>

            <s-divider />

            <s-box paddingBlock="base">
  <s-text>
    Barcode won't scan?
  </s-text>
</s-box>

<s-button
  variant="secondary"
  disabled={busy}
  onClick={takePhoto}
>
  📷 TAKE A PHOTO
</s-button>

<s-box paddingBlockStart="base">
  <s-button
    variant="secondary"
    disabled={busy}
    onClick={openSearch}
  >
    FIND MY ITEM
  </s-button>
</s-box>

            {status ? (
              <s-box paddingBlockStart="base">
                <s-text>{status}</s-text>
              </s-box>
            ) : null}

          </s-box>

        ) : (

          /* SHOPPING BAG */
          <>
            {status ? (
              <s-box
                paddingInline="large"
                paddingBlock="base"
              >
                <s-heading>{status}</s-heading>
              </s-box>
            ) : null}

            <s-box padding="large">

              <s-heading>YOUR BAG</s-heading>

              {items.map((item) => (
                <s-box
                  key={item.uuid}
                  paddingBlock="base"
                >
                  <s-heading>{item.title}</s-heading>

                  <s-number-field
                    value={String(item.quantity)}
                    min={0}
                    max={99}
                    step={1}
                    controls="stepper"
                    disabled={busy}
                    onChange={(event) => {
                      const newQuantity = Number(
                        event.currentTarget.value,
                      );

                      if (
                        newQuantity > item.quantity
                      ) {
                        addOne(item);
                      } else if (
                        newQuantity < item.quantity
                      ) {
                        removeOne(item);
                      }
                    }}
                  />

                </s-box>
              ))}

            </s-box>

            <s-divider />

            <s-box padding="large">
              <s-heading>
                TOTAL 
                {formatMoney(cart?.grandTotal)}
              </s-heading>
            </s-box>

            <s-box paddingInline="large">

              <s-button
  variant="secondary"
  loading={busy}
  onClick={scanItem}
>
  + SCAN ANOTHER ITEM
</s-button>

<s-box paddingBlockStart="base">
  <s-button
    variant="secondary"
    disabled={busy}
    onClick={takePhoto}
  >
    📷 TAKE A PHOTO
  </s-button>
</s-box>

<s-box paddingBlock="base">
  <s-button
    variant="secondary"
    disabled={busy}
    onClick={openSearch}
  >
    FIND MY ITEM
  </s-button>
</s-box>

              <s-button
                variant="primary"
                disabled={busy}
                onClick={() => window.close()}
              >
                I'M DONE — PAY
              </s-button>

            </s-box>

            <s-box
              paddingInline="large"
              paddingBlock="base"
            >
              <s-button
                variant="secondary"
                tone="critical"
                disabled={busy}
                onClick={startOver}
              >
                Start Over
              </s-button>
            </s-box>

          </>
        )}

      </s-scroll-box>
    </s-page>
  );
}