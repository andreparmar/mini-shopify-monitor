import twilio from "twilio";
import type { VariantState } from "./types";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_FROM_NUMBER!;
const toNumber = process.env.NOTIFY_PHONE_NUMBER!;

async function isImageFetchable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const ct = res.headers.get("content-type") ?? "";
    return res.ok && ct.startsWith("image/");
  } catch {
    return false;
  }
}

export async function sendRestockAlert(variant: VariantState): Promise<void> {
  const client = twilio(accountSid, authToken);

  const body = [
    `🚨 RESTOCK: ${variant.productTitle}`,
    `${variant.variantTitle} — $${variant.price}`,
    ``,
    `Buy now: ${variant.productUrl}`,
  ].join("\n");

  const params: Parameters<typeof client.messages.create>[0] = {
    body,
    from: fromNumber,
    to: toNumber,
  };

  if (variant.imageUrl && (await isImageFetchable(variant.imageUrl))) {
    params.mediaUrl = [variant.imageUrl];
    console.log(`[NOTIFIER] Image attached: ${variant.imageUrl}`);
  } else {
    console.log(`[NOTIFIER] Image not fetchable — sending SMS only`);
  }

  await client.messages.create(params);

  console.log(`[ALERT SENT] ${variant.productTitle} — ${variant.variantTitle}`);
}
