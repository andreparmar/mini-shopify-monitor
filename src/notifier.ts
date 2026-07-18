import { buildPlainCartUrl, buildPrefilledCartUrl } from "./cartLinks";
import type { CartLinksConfig, CheckoutDetails, VariantState } from "./types";

const NTFY_TOPIC = process.env.NTFY_TOPIC!;
const NTFY_BASE = "https://ntfy.sh";

const HAT_KEYWORDS = ["hat", "trucker", "bucket", "dad hat", "cap", "beanie"];

function isHat(title: string): boolean {
  const lower = title.toLowerCase();
  return HAT_KEYWORDS.some((kw) => lower.includes(kw));
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

  const res = await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    throw new Error(`ntfy returned ${res.status}: ${await res.text()}`);
  }

  console.log(`[ALERT SENT]${hat ? " [HAT]" : ""} ${variant.productTitle} — ${variant.variantTitle} (${stockLine})`);
}
