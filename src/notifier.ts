import type { VariantState } from "./types";

const NTFY_TOPIC = process.env.NTFY_TOPIC!;
const NTFY_BASE = "https://ntfy.sh";

const HAT_KEYWORDS = ["hat", "trucker", "bucket", "dad hat", "cap", "beanie"];

function isHat(title: string): boolean {
  const lower = title.toLowerCase();
  return HAT_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function sendRestockAlert(variant: VariantState): Promise<void> {
  const hat = isHat(variant.productTitle);

  const stockLine =
    variant.totalVariants === 1
      ? "1 variant in stock"
      : `${variant.availableVariants}/${variant.totalVariants} variants in stock`;

  const body = [
    `${variant.variantTitle} — $${variant.price}`,
    stockLine,
    "",
    "Tap to buy now",
  ].join("\n");

  const headers: Record<string, string> = {
    "Title": `RESTOCK: ${variant.productTitle}`,
    "Priority": hat ? "urgent" : "high",
    "Tags": hat ? "rotating_light,billed_cap" : "rotating_light",
    "Click": variant.productUrl,
    "Content-Type": "text/plain",
  };

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
