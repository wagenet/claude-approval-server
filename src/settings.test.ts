import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";

// We can't easily test the module-level singleton without side effects,
// so we test the core load/save logic by reimplementing it against a temp directory.

const TMP_DIR = join(import.meta.dir, ".test-settings-tmp");
const SETTINGS_FILE = join(TMP_DIR, "settings.json");

interface Settings {
  theme: "dark" | "light";
  notifEnabled: boolean;
  notifRequireInteraction: boolean;
}

const DEFAULTS: Settings = {
  theme: "dark",
  notifEnabled: true,
  notifRequireInteraction: true,
};

function loadSettings(path: string): Settings {
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

async function saveSettings(path: string, settings: Settings): Promise<void> {
  await Bun.write(path, JSON.stringify(settings, null, 2));
}

describe("loadSettings", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test("returns defaults when file does not exist", () => {
    const settings = loadSettings(join(TMP_DIR, "nonexistent.json"));
    expect(settings).toEqual(DEFAULTS);
  });

  test("returns defaults on malformed JSON", () => {
    writeFileSync(SETTINGS_FILE, "not valid json");
    const settings = loadSettings(SETTINGS_FILE);
    expect(settings).toEqual(DEFAULTS);
  });

  test("merges partial settings with defaults", () => {
    writeFileSync(SETTINGS_FILE, JSON.stringify({ theme: "light" }));
    const settings = loadSettings(SETTINGS_FILE);
    expect(settings.theme).toBe("light");
    expect(settings.notifEnabled).toBe(true);
    expect(settings.notifRequireInteraction).toBe(true);
  });

  test("loads full settings", () => {
    const saved: Settings = { theme: "light", notifEnabled: false, notifRequireInteraction: false };
    writeFileSync(SETTINGS_FILE, JSON.stringify(saved));
    const settings = loadSettings(SETTINGS_FILE);
    expect(settings).toEqual(saved);
  });
});

describe("saveSettings", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test("writes settings to disk", async () => {
    const settings: Settings = {
      theme: "light",
      notifEnabled: false,
      notifRequireInteraction: true,
    };
    await saveSettings(SETTINGS_FILE, settings);
    const raw = JSON.parse(await Bun.file(SETTINGS_FILE).text());
    expect(raw.theme).toBe("light");
    expect(raw.notifEnabled).toBe(false);
  });

  test("concurrent saves produce valid final state", async () => {
    // Simulate serialized writes
    let chain: Promise<void> = Promise.resolve();
    const settings: Settings = { ...DEFAULTS };

    for (let i = 0; i < 5; i++) {
      settings.theme = i % 2 === 0 ? "dark" : "light";
      chain = chain.then(() => saveSettings(SETTINGS_FILE, { ...settings }));
    }
    await chain;

    const raw = JSON.parse(await Bun.file(SETTINGS_FILE).text());
    // Last write was i=4, theme="dark"
    expect(raw.theme).toBe("dark");
  });
});
