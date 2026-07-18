import { sendRestockAlert } from "./notifier";
import { loadConfig } from "./config";
import { loadCheckoutDetailsFromEnv, resolveCartLinksConfig } from "./cartLinks";

async function main() {
  if (!process.env.NTFY_TOPIC) {
    console.error("Missing env var: NTFY_TOPIC");
    process.exit(1);
  }

  const config = loadConfig();
  const storeName = process.argv[2];
  const store = storeName
    ? config.stores.find((s) => s.name === storeName)
    : config.stores[0];

  if (!store) {
    const names = config.stores.map((s) => s.name).join(", ");
    console.error(`Store '${storeName}' not found. Available: ${names}`);
    process.exit(1);
  }

  console.log(`Fetching live product from ${store.name} (${store.url})...`);

  const res = await fetch(`${store.url}/products.json?limit=250`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; restock-monitor/1.0)" },
  });

  if (!res.ok) {
    console.error(`${store.name}: products.json returned ${res.status} — try again in a minute (Shopify throttled this request)`);
    process.exit(1);
  }

  const data = (await res.json()) as {
    products: Array<{
      title: string;
      handle: string;
      images: Array<{ src: string }>;
      variants: Array<{ id: number; title: string; price: string; available: boolean }>;
    }>;
  };

  const product = data.products[data.products.length - 1];
  const variant = product.variants[0];
  const imageUrl = product.images[0]?.src ?? "";

  const testVariant = {
    variantId: String(variant.id),
    available: true,
    productTitle: product.title,
    variantTitle: variant.title,
    price: variant.price,
    imageUrl,
    productUrl: `${store.url}/products/${product.handle}`,
    availableVariants: product.variants.filter((v) => v.available).length,
    totalVariants: product.variants.length,
  };

  const cartLinks = resolveCartLinksConfig(config, store);
  const checkoutDetails = loadCheckoutDetailsFromEnv();

  console.log(`Sending test alert for: ${testVariant.productTitle}`);
  console.log(`URL: ${testVariant.productUrl}`);
  console.log(`Image: ${testVariant.imageUrl}`);
  console.log(`Cart links mode: ${cartLinks.mode} (qty ${cartLinks.quantity})`);

  await sendRestockAlert(testVariant, cartLinks, store.url, checkoutDetails);
  console.log("Done — check your phone.");
}

main().catch((err) => {
  console.error("Test failed:", err?.message ?? err);
  if (err?.cause) {
    console.error("Cause:", err.cause);
  }
  process.exit(1);
});
