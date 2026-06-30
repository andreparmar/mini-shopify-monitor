import { sendRestockAlert } from "./notifier";

const SHOP_URL = "https://alexzono.com";

async function main() {
  if (!process.env.NTFY_TOPIC) {
    console.error("Missing env var: NTFY_TOPIC");
    process.exit(1);
  }

  // Pull a real product live from the store so URLs and images are always valid
  const res = await fetch(`${SHOP_URL}/products.json?limit=250`);
  const data = (await res.json()) as {
    products: Array<{
      title: string;
      handle: string;
      images: Array<{ src: string }>;
      variants: Array<{ title: string; price: string; available: boolean }>;
    }>;
  };

  const product = data.products[data.products.length - 1];
  const variant = product.variants[0];
  const imageUrl = product.images[0]?.src ?? "";

  const testVariant = {
    available: true,
    productTitle: product.title,
    variantTitle: variant.title,
    price: variant.price,
    imageUrl,
    productUrl: `${SHOP_URL}/products/${product.handle}`,
    availableVariants: product.variants.filter((v) => v.available).length,
    totalVariants: product.variants.length,
  };

  console.log(`Sending test alert to ntfy topic: ${process.env.NTFY_TOPIC}`);
  console.log(`Product: ${testVariant.productTitle}`);
  console.log(`URL: ${testVariant.productUrl}`);
  console.log(`Image: ${testVariant.imageUrl}`);

  await sendRestockAlert(testVariant);
  console.log("Done — check your phone.");
}

main().catch((err) => {
  console.error("Test failed:", err?.message ?? err);
  process.exit(1);
});
