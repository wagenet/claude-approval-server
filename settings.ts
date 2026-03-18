import { homedir } from "node:os";
import { join } from "node:path";

export interface Settings {
  theme: "dark" | "light";
  notifRequireInteraction: boolean;
}

const DEFAULTS: Settings = {
  theme: "dark",
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

export async function saveSettings(): Promise<void> {
  await Bun.write(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}
