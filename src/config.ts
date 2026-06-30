import fs from "fs";
import path from "path";
import type { MonitorConfig } from "./types";

const CONFIG_PATH = path.join(process.cwd(), "config.json");

export function loadConfig(): MonitorConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`config.json not found at ${CONFIG_PATH}`);
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw) as MonitorConfig;

  if (!Array.isArray(config.stores) || config.stores.length === 0) {
    throw new Error("config.json must have at least one store in 'stores'");
  }

  for (const store of config.stores) {
    if (!store.name) throw new Error(`Store missing 'name'`);
    if (!store.url) throw new Error(`Store '${store.name}' missing 'url'`);
    if (!store.intervalSeconds || store.intervalSeconds < 5) {
      throw new Error(`Store '${store.name}' intervalSeconds must be >= 5`);
    }
    if (!Array.isArray(store.targets) || store.targets.length === 0) {
      throw new Error(`Store '${store.name}' must have at least one target`);
    }
  }

  return config;
}
