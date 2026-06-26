import type { VariantState } from "./types";

const NTFY_TOPIC = process.env.NTFY_TOPIC!;
const NTFY_BASE = "https://ntfy.sh";

export async function sendRestockAlert(variant: VariantState): Promise<void> {
  const body = `${variant.variantTitle} — $${variant.price}\n\nTap to buy now`;

  const headers: Record<string, string> = {
    "Title": `🚨 RESTOCK: ${variant.productTitle}`,
    "Priority": "urgent",
    "Tags": "rotating_light",
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

  console.log(`[ALERT SENT] ${variant.productTitle} — ${variant.variantTitle}`);
}
