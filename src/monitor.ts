import { loadState, saveState } from "./state";
import { sendRestockAlert } from "./notifier";
import type {
  ShopifyProduct,
  ShopifyProductsResponse,
  StateMap,
  VariantState,
} from "./types";

const SHOP_URL = "https://alexzono.com";
const PRODUCTS_URL = `${SHOP_URL}/products.json?limit=250`;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "60000", 10);

function getImageUrl(product: ShopifyProduct, variantImageSrc: string | undefined): string {
  if (variantImageSrc) return variantImageSrc;
  if (product.images.length > 0) return product.images[0].src;
  return "";
}

async function fetchProducts(): Promise<ShopifyProduct[]> {
  const res = await fetch(PRODUCTS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; restock-monitor/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`products.json returned ${res.status}`);
  }

  const data = (await res.json()) as ShopifyProductsResponse;
  return data.products;
}

function buildStateMap(products: ShopifyProduct[]): StateMap {
  const map: StateMap = {};

  for (const product of products) {
    for (const variant of product.variants) {
      const key = String(variant.id);
      map[key] = {
        available: variant.available,
        productTitle: product.title,
        variantTitle: variant.title,
        price: variant.price,
        imageUrl: getImageUrl(product, variant.featured_image?.src),
        productUrl: `${SHOP_URL}/products/${product.handle}`,
      };
    }
  }

  return map;
}

async function poll(previousState: StateMap, isFirstRun: boolean): Promise<StateMap> {
  const timestamp = new Date().toISOString();

  try {
    const products = await fetchProducts();
    const currentState = buildStateMap(products);
    const restocked: VariantState[] = [];

    for (const [id, current] of Object.entries(currentState)) {
      const previous = previousState[id];

      if (!isFirstRun && previous && !previous.available && current.available) {
        restocked.push(current);
      }
    }

    if (restocked.length > 0) {
      console.log(`[${timestamp}] ${restocked.length} restock(s) detected — sending alerts`);
      for (const variant of restocked) {
        try {
          await sendRestockAlert(variant);
        } catch (err) {
          console.error(`[ERROR] Failed to send alert for ${variant.productTitle}:`, err);
        }
      }
    } else {
      const total = Object.keys(currentState).length;
      const available = Object.values(currentState).filter((v) => v.available).length;
      console.log(`[${timestamp}] OK — ${available}/${total} variants in stock, no changes`);
    }

    saveState(currentState);
    return currentState;
  } catch (err) {
    console.error(`[${timestamp}] Poll failed:`, err);
    return previousState;
  }
}

async function main() {
  console.log(`[INIT] Shopify monitor starting — polling ${SHOP_URL} every ${POLL_INTERVAL_MS / 1000}s`);

  const requiredEnv = ["NTFY_TOPIC"];

  for (const key of requiredEnv) {
    if (!process.env[key]) {
      console.error(`[FATAL] Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  let state = loadState();
  const isFirstRun = Object.keys(state).length === 0;

  if (isFirstRun) {
    console.log("[INIT] No saved state — running silent baseline poll...");
  }

  state = await poll(state, isFirstRun);

  if (isFirstRun) {
    console.log("[INIT] Baseline set. Monitoring for changes...");
  }

  setInterval(async () => {
    state = await poll(state, false);
  }, POLL_INTERVAL_MS);
}

main();
