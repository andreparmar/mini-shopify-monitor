import { loadConfig } from "./config";
import { resolveCartLinksConfig } from "./cartLinks";
import type { Target } from "./types";

function describeTarget(target: Target): string {
  if (target.type === "all") return "All products";
  if (target.type === "handle") return `Handle: ${target.value}`;
  if (target.type === "variant_id") return `Variant ID: ${target.value}`;
  if (target.type === "keywords") {
    const inc = target.include.length ? target.include.join(", ") : "—";
    const exc = target.exclude.length ? target.exclude.join(", ") : "—";
    return `Keywords  include: [${inc}]  exclude: [${exc}]`;
  }
  return JSON.stringify(target);
}

function describeCartLinks(store: Parameters<typeof resolveCartLinksConfig>[1], hasOverride: boolean, resolved: ReturnType<typeof resolveCartLinksConfig>): string {
  const source = hasOverride ? "override" : "global";
  const labels: Record<string, string> = { off: "Off", cart: "Cart", checkout: "Cart & Checkout" };
  return `${labels[resolved.mode] ?? resolved.mode}  (qty ${resolved.quantity}, ${source})`;
}

function main() {
  const config = loadConfig();

  console.log(`\n── Monitor Status — ${config.stores.length} store(s) ──\n`);

  const globalCartLinks = config.cartLinks ?? { mode: "off", quantity: 1 };
  console.log(`  Global cart links: ${globalCartLinks.mode}  (qty ${globalCartLinks.quantity})\n`);

  for (const store of config.stores) {
    const resolved = resolveCartLinksConfig(config, store);
    console.log(`  Store:      ${store.name}`);
    console.log(`  URL:        ${store.url}`);
    console.log(`  Interval:   ${store.intervalSeconds}s`);
    console.log(`  Cart links: ${describeCartLinks(store, Boolean(store.cartLinks), resolved)}`);
    console.log(`  Targets:`);
    for (const target of store.targets) {
      console.log(`    • ${describeTarget(target)}`);
    }
    console.log();
  }
}

main();
