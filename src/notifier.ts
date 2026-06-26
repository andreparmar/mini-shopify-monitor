import twilio from "twilio";
import type { VariantState } from "./types";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_FROM_NUMBER!;
const toNumber = process.env.NOTIFY_PHONE_NUMBER!;

export async function sendRestockAlert(variant: VariantState): Promise<void> {
  const client = twilio(accountSid, authToken);

  const body = [
    `🚨 RESTOCK ALERT — ${variant.productTitle}`,
    `Variant: ${variant.variantTitle}`,
    `Price: $${variant.price}`,
    ``,
    `Buy now: ${variant.productUrl}`,
  ].join("\n");

  await client.messages.create({
    body,
    from: fromNumber,
    to: toNumber,
    mediaUrl: [variant.imageUrl],
  });

  console.log(
    `[ALERT SENT] ${variant.productTitle} — ${variant.variantTitle}`
  );
}
