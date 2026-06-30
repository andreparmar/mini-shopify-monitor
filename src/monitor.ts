import { loadState, saveState } from "./state";
import { sendRestockAlert } from "./notifier";
import { loadConfig } from "./config";
import type {
  ShopifyProduct,
  ShopifyProductsResponse,
  ShopifyVariant,
  StateMap,
  StoreConfig,
  Target,
  VariantState,
} from "./types";

const RETRY_DELAYS_MS = [5000, 10000, 15000];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getImageUrl(product: ShopifyProduct, variantImageSrc: string | undefined): string {
  if (variantImageSrc) return variantImageSrc;
  if (product.images.length > 0) return product.images[0].src;
  return "";
}

function matchesTargets(product: ShopifyProduct, variant: ShopifyVariant, targets: Target[]): boolean {
  for (const target of targets) {
    if (target.type === "all") return true;

    if (target.type === "handle" && product.handle === target.value) return true;

    if (target.type === "variant_id" && String(variant.id) === target.value) return true;

    if (target.type === "keywords") {
      const title = product.title.toLowerCase();
      const allIncluded = target.include.length === 0 || target.include.every((kw) => title.includes(kw.toLowerCase()));
      const noneExcluded = target.exclude.every((kw) => !title.includes(kw.toLowerCase()));
      if (allIncluded && noneExcluded) return true;
    }
  }
  return false;
}

async function fetchProducts(store: StoreConfig): Promise<ShopifyProduct[]> {
  const url = `${store.url}/products.json?limit=250`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; restock-monitor/1.0)" },
  });

  if (!res.ok) throw new Error(`${store.name}: products.json returned ${res.status}`);

  const data = (await res.json()) as ShopifyProductsResponse;
  return data.products;
}

async function fetchWithRetry(store: StoreConfig): Promise<ShopifyProduct[]> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fetchProducts(store);
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`[${store.name}][RETRY ${attempt + 1}] ${(err as Error).message} — retrying in ${delay / 1000}s`);
        await sleep(delay);
      }
    }
  }

  throw lastErr;
}

function buildStateMap(store: StoreConfig, products: ShopifyProduct[]): StateMap {
  const map: StateMap = {};

  for (const product of products) {
    const matchingVariants = product.variants.filter((v) => matchesTargets(product, v, store.targets));
    if (matchingVariants.length === 0) continue;

    const totalVariants = product.variants.length;
    const availableVariants = product.variants.filter((v) => v.available).length;

    for (const variant of matchingVariants) {
      map[String(variant.id)] = {
        available: variant.available,
        productTitle: product.title,
        variantTitle: variant.title,
        price: variant.price,
        imageUrl: getImageUrl(product, variant.featured_image?.src),
        productUrl: `${store.url}/products/${product.handle}`,
        availableVariants,
        totalVariants,
      };
    }
  }

  return map;
}

async function poll(store: StoreConfig, previousState: StateMap, isFirstRun: boolean): Promise<StateMap> {
  const timestamp = new Date().toISOString();

  try {
    const products = await fetchWithRetry(store);
    const currentState = buildStateMap(store, products);
    const restocked: VariantState[] = [];

    for (const [id, current] of Object.entries(currentState)) {
      const previous = previousState[id];
      if (!isFirstRun && previous && !previous.available && current.available) {
        restocked.push(current);
      }
    }

    if (restocked.length > 0) {
      console.log(`[${store.name}][${timestamp}] ${restocked.length} restock(s) detected — sending alerts`);
      for (const variant of restocked) {
        try {
          await sendRestockAlert(variant);
        } catch (err) {
          console.error(`[${store.name}][ERROR] Failed to send alert for ${variant.productTitle}:`, err);
        }
      }
    } else {
      const total = Object.keys(currentState).length;
      const available = Object.values(currentState).filter((v) => v.available).length;
      console.log(`[${store.name}][${timestamp}] OK — ${available}/${total} variants in stock, no changes`);
    }

    saveState(store.name, currentState);
    return currentState;
  } catch (err) {
    console.error(`[${store.name}][${timestamp}] Poll failed after retries:`, err);
    return previousState;
  }
}

async function runStore(store: StoreConfig): Promise<void> {
  const intervalMs = store.intervalSeconds * 1000;
  console.log(`[${store.name}] Starting — polling ${store.url} every ${store.intervalSeconds}s`);

  let state = loadState(store.name);
  const isFirstRun = Object.keys(state).length === 0;

  if (isFirstRun) {
    console.log(`[${store.name}] No saved state — running silent baseline poll...`);
  }

  state = await poll(store, state, isFirstRun);

  if (isFirstRun) {
    console.log(`[${store.name}] Baseline set. Monitoring for changes...`);
  }

  setInterval(async () => {
    state = await poll(store, state, false);
  }, intervalMs);
}

async function main() {
  if (!process.env.NTFY_TOPIC) {
    console.error("[FATAL] Missing required env var: NTFY_TOPIC");
    process.exit(1);
  }

  const config = loadConfig();
  console.log(`[INIT] Loaded ${config.stores.length} store(s) from config.json`);

  // Run all store loops in parallel — each manages its own interval
  await Promise.all(config.stores.map(runStore));
}

main();
