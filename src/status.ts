import { loadConfig } from "./config";
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

function main() {
  const config = loadConfig();

  console.log(`\n── Monitor Status — ${config.stores.length} store(s) ──\n`);

  for (const store of config.stores) {
    console.log(`  Store:    ${store.name}`);
    console.log(`  URL:      ${store.url}`);
    console.log(`  Interval: ${store.intervalSeconds}s`);
    console.log(`  Targets:`);
    for (const target of store.targets) {
      console.log(`    • ${describeTarget(target)}`);
    }
    console.log();
  }
}

main();
