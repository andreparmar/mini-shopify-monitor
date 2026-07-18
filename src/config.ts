import fs from "fs";
import path from "path";
import type { CartLinksConfig, MonitorConfig } from "./types";

const CONFIG_PATH = path.join(process.cwd(), "config.json");
const VALID_CART_LINK_MODES = new Set(["off", "cart", "checkout"]);

function validateCartLinks(cartLinks: CartLinksConfig | undefined, context: string): void {
  if (!cartLinks) return;
  if (!VALID_CART_LINK_MODES.has(cartLinks.mode)) {
    throw new Error(`${context}: cartLinks.mode must be one of off/cart/checkout`);
  }
  if (!Number.isInteger(cartLinks.quantity) || cartLinks.quantity < 1) {
    throw new Error(`${context}: cartLinks.quantity must be a positive integer`);
  }
}

export function loadConfig(): MonitorConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`config.json not found at ${CONFIG_PATH}`);
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw) as MonitorConfig;

  if (!Array.isArray(config.stores) || config.stores.length === 0) {
    throw new Error("config.json must have at least one store in 'stores'");
  }

  validateCartLinks(config.cartLinks, "config.json");

  for (const store of config.stores) {
    if (!store.name) throw new Error(`Store missing 'name'`);
    if (!store.url) throw new Error(`Store '${store.name}' missing 'url'`);
    if (!store.intervalSeconds || store.intervalSeconds < 5) {
      throw new Error(`Store '${store.name}' intervalSeconds must be >= 5`);
    }
    if (!Array.isArray(store.targets) || store.targets.length === 0) {
      throw new Error(`Store '${store.name}' must have at least one target`);
    }
    validateCartLinks(store.cartLinks, `Store '${store.name}'`);
  }

  return config;
}
