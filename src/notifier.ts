import { buildPlainCartUrl, buildPrefilledCartUrl } from "./cartLinks";
import type { CartLinksConfig, CheckoutDetails, VariantState } from "./types";

const NTFY_TOPIC = process.env.NTFY_TOPIC!;
const NTFY_BASE = "https://ntfy.sh";
const RETRY_DELAYS_MS = [2000, 5000];

const HAT_KEYWORDS = ["hat", "trucker", "bucket", "dad hat", "cap", "beanie"];

function isHat(title: string): boolean {
  const lower = title.toLowerCase();
  return HAT_KEYWORDS.some((kw) => lower.includes(kw));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// A failed restock alert can't be retried on the next poll — the variant's state
// is already marked available by then — so this send gets its own short retry
// window to ride out transient network blips reaching ntfy.sh.
async function postWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`ntfy returned ${res.status}: ${await res.text()}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`[NTFY RETRY ${attempt + 1}] ${(err as Error).message} — retrying in ${delay / 1000}s`);
        await sleep(delay);
      }
    }
  }

  throw lastErr;
}

// ntfy renders up to 3 of these as real tappable buttons on the notification itself
// (lock screen / banner) — unlike markdown links, which only render inside the app.
function buildActionsHeader(actions: Array<{ label: string; url: string }>): string {
  return actions.map(({ label, url }) => `view, ${label}, ${url}`).join("; ");
}

export async function sendRestockAlert(
  variant: VariantState,
  cartLinks: CartLinksConfig,
  storeUrl: string,
  checkoutDetails: CheckoutDetails
): Promise<void> {
  const hat = isHat(variant.productTitle);

  const stockLine =
    variant.totalVariants === 1
      ? "1 variant in stock"
      : `${variant.availableVariants}/${variant.totalVariants} variants in stock`;

  const lines = [`${variant.variantTitle} — $${variant.price}`, stockLine];
  const actions: Array<{ label: string; url: string }> = [];

  if (cartLinks.mode === "off") {
    lines.push("", "Tap to buy now");
  } else {
    const cartUrl = buildPlainCartUrl(storeUrl, variant.variantId, cartLinks.quantity);
    actions.push({ label: `Add ${cartLinks.quantity} to cart`, url: cartUrl });

    if (cartLinks.mode === "checkout") {
      const checkoutUrl = buildPrefilledCartUrl(storeUrl, variant.variantId, cartLinks.quantity, checkoutDetails);
      actions.push({ label: "Fast checkout", url: checkoutUrl });
    }
  }

  const body = lines.join("\n");

  const headers: Record<string, string> = {
    "Title": `RESTOCK: ${variant.productTitle}`,
    "Priority": hat ? "urgent" : "high",
    "Tags": hat ? "rotating_light,billed_cap" : "rotating_light",
    "Click": variant.productUrl,
    "Content-Type": "text/plain",
  };

  if (actions.length > 0) {
    headers["Actions"] = buildActionsHeader(actions);
  }

  if (variant.imageUrl) {
    headers["Attach"] = variant.imageUrl;
  }

  await postWithRetry(`${NTFY_BASE}/${NTFY_TOPIC}`, {
    method: "POST",
    headers,
    body,
  });

  console.log(`[ALERT SENT]${hat ? " [HAT]" : ""} ${variant.productTitle} — ${variant.variantTitle} (${stockLine})`);
}
