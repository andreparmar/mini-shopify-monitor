import { buildPlainCartUrl, buildPrefilledCartUrl } from "./cartLinks";
import type { CartLinksConfig, CheckoutDetails, VariantState } from "./types";

const NTFY_TOPIC = process.env.NTFY_TOPIC!;
const NTFY_BASE = "https://ntfy.sh";

const HAT_KEYWORDS = ["hat", "trucker", "bucket", "dad hat", "cap", "beanie"];

function isHat(title: string): boolean {
  const lower = title.toLowerCase();
  return HAT_KEYWORDS.some((kw) => lower.includes(kw));
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

  const lines = [`${variant.variantTitle} — $${variant.price}`, stockLine, ""];

  let clickUrl = variant.productUrl;
  let useMarkdown = false;

  if (cartLinks.mode === "off") {
    lines.push("Tap to buy now");
  } else {
    const cartUrl = buildPlainCartUrl(storeUrl, variant.variantId, cartLinks.quantity);
    lines.push(`[View product](${variant.productUrl})`);
    lines.push(`[Add ${cartLinks.quantity} to cart](${cartUrl})`);
    clickUrl = cartUrl;
    useMarkdown = true;

    if (cartLinks.mode === "checkout") {
      const checkoutUrl = buildPrefilledCartUrl(storeUrl, variant.variantId, cartLinks.quantity, checkoutDetails);
      lines.push(`[Fast checkout](${checkoutUrl})`);
      clickUrl = checkoutUrl;
    }
  }

  const body = lines.join("\n");

  const headers: Record<string, string> = {
    "Title": `RESTOCK: ${variant.productTitle}`,
    "Priority": hat ? "urgent" : "high",
    "Tags": hat ? "rotating_light,billed_cap" : "rotating_light",
    "Click": clickUrl,
    "Content-Type": "text/plain",
  };

  if (useMarkdown) {
    headers["Markdown"] = "yes";
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
