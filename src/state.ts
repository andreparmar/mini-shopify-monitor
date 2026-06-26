import fs from "fs";
import path from "path";
import type { StateMap } from "./types";

const STATE_FILE = path.join(process.cwd(), "data", "state.json");

export function loadState(): StateMap {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw) as StateMap;
  } catch {
    return {};
  }
}

export function saveState(state: StateMap): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}
