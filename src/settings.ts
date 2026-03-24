import { homedir } from "node:os";
import { join } from "node:path";

export interface Settings {
  theme: "dark" | "light";
  notifEnabled: boolean;
  notifRequireInteraction: boolean;
}

const DEFAULTS: Settings = {
  theme: "dark",
  notifEnabled: true,
  notifRequireInteraction: true,
};
const SETTINGS_FILE = join(homedir(), ".claude", "claude-approval-server", "settings.json");

export const settings: Settings = loadSettings();

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(Bun.file(SETTINGS_FILE).textSync());
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

// Serialize writes so concurrent PATCH /config calls don't interleave on disk.
let saveChain: Promise<void> = Promise.resolve();

export function saveSettings(): Promise<void> {
  saveChain = saveChain.then(() => Bun.write(SETTINGS_FILE, JSON.stringify(settings, null, 2)));
  return saveChain;
}
