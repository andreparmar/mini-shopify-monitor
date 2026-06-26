import { sendRestockAlert } from "./notifier";

// Sends a real test MMS using your Railway env vars and a live alexzono product image
async function main() {
  const required = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "NOTIFY_PHONE_NUMBER",
  ];

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing env var: ${key}`);
      process.exit(1);
    }
  }

  console.log(`Sending test MMS to ${process.env.NOTIFY_PHONE_NUMBER}...`);

  await sendRestockAlert({
    available: true,
    productTitle: '"I Dig Running" Trucker Hat OG',
    variantTitle: "One Size",
    price: "35.00",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0841/3465/8396/files/IMG_3216.jpg",
    productUrl: "https://alexzono.com/products/i-dig-running-trucker-hat-og",
  });

  console.log("Done — check your phone.");
}

main().catch((err) => {
  console.error("Test failed:", err?.message ?? err);
  process.exit(1);
});
