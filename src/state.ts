import fs from "fs";
import path from "path";
import type { StateMap } from "./types";

function stateFile(storeName: string): string {
  return path.join(process.cwd(), "data", `state-${storeName}.json`);
}

export function loadState(storeName: string): StateMap {
  const file = stateFile(storeName);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as StateMap;
  } catch {
    return {};
  }
}

export function saveState(storeName: string, state: StateMap): void {
  const file = stateFile(storeName);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2), "utf-8");
}
