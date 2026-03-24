#!/usr/bin/env bun
import { homedir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT ?? 4759);
const SHIM_DIR = join(homedir(), ".claude", "claude-approval-server");
const SHIM_DEST = join(SHIM_DIR, "hook-shim.sh");
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const LOG_OUT = "/tmp/claude-approval.log";
const LOG_ERR = "/tmp/claude-approval.error.log";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

type HookCommand =
  | { type: string; command: string; timeout: number }
  | { type: string; command: string };

type HookEntry = {
  matcher?: string;
  hooks: HookCommand[];
};

type HookType = "PermissionRequest" | "PostToolUse" | "Stop";

export function buildHookEntry(hookType: HookType, shimPath: string): HookEntry {
  switch (hookType) {
    case "PermissionRequest":
      return {
        matcher: "",
        hooks: [{ type: "command", command: `${shimPath} pending`, timeout: 600 }],
      };
    case "PostToolUse":
      return {
        matcher: "",
        hooks: [{ type: "command", command: `${shimPath} post-tool-use`, timeout: 5 }],
      };
    case "Stop":
      return {
        matcher: "",
        hooks: [{ type: "command", command: `${shimPath} stop` }],
      };
  }
}

type ClaudeSettings = {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
};

function isHookEntry(val: unknown): val is HookEntry {
  if (typeof val !== "object" || val === null) return false;
  const v = val as Record<string, unknown>;
  return Array.isArray(v.hooks);
}

/** Compute merged settings object without any I/O. Exported for testing. */
export function computeMergedHooks(obj: ClaudeSettings, shimPath: string): ClaudeSettings {
  const result: ClaudeSettings = { ...obj, hooks: { ...obj.hooks } };
  const hooks = result.hooks!;

  const hookTypes: HookType[] = ["PermissionRequest", "PostToolUse", "Stop"];
  for (const hookType of hookTypes) {
    const existing = Array.isArray(hooks[hookType]) ? (hooks[hookType] as HookEntry[]) : [];

    const idx = existing.findIndex(
      (entry) =>
        isHookEntry(entry) &&
        entry.hooks.some(
          (h) => typeof h.command === "string" && h.command.includes("claude-approval-server"),
        ),
    );

    const newEntry = buildHookEntry(hookType, shimPath);
    if (idx >= 0) {
      existing[idx] = newEntry;
    } else {
      existing.push(newEntry);
    }
    hooks[hookType] = existing;
  }
  return result;
}

/** Compute settings object with hooks removed. Exported for testing. */
export function computeRemovedHooks(obj: ClaudeSettings): ClaudeSettings {
  if (!obj.hooks) return obj;

  const hooks: Record<string, HookEntry[]> = {};
  for (const [hookType, entries] of Object.entries(obj.hooks)) {
    if (!Array.isArray(entries)) {
      hooks[hookType] = entries;
      continue;
    }
    const filtered = (entries as HookEntry[]).filter(
      (entry) =>
        !isHookEntry(entry) ||
        !entry.hooks.some(
          (h) => typeof h.command === "string" && h.command.includes("claude-approval-server"),
        ),
    );
    if (filtered.length > 0) {
      hooks[hookType] = filtered;
    }
  }

  const result: ClaudeSettings = { ...obj };
  if (Object.keys(hooks).length > 0) {
    result.hooks = hooks;
  } else {
    delete result.hooks;
  }
  return result;
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

async function readClaudeSettings(settingsPath: string): Promise<ClaudeSettings> {
  try {
    const raw = await Bun.file(settingsPath).text();
    return JSON.parse(raw) as ClaudeSettings;
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(`Error: ${settingsPath} contains invalid JSON. Fix it manually.`);
      process.exit(1);
    }
    return {};
  }
}

async function writeClaudeSettings(settingsPath: string, obj: ClaudeSettings): Promise<void> {
  await Bun.write(settingsPath, JSON.stringify(obj, null, 2) + "\n");
}

async function mergeClaudeHooks(shimPath: string, settingsPath = CLAUDE_SETTINGS): Promise<void> {
  const obj = await readClaudeSettings(settingsPath);
  const merged = computeMergedHooks(obj, shimPath);
  await writeClaudeSettings(settingsPath, merged);
}

async function removeClaudeHooks(settingsPath = CLAUDE_SETTINGS): Promise<void> {
  const obj = await readClaudeSettings(settingsPath);
  const cleaned = computeRemovedHooks(obj);
  await writeClaudeSettings(settingsPath, cleaned);
}

// ---------------------------------------------------------------------------
// CLI commands
// ---------------------------------------------------------------------------

async function runInstallHooks(): Promise<void> {
  const shimFile = Bun.file(new URL("../hook-shim.sh", import.meta.url));

  await Bun.$`mkdir -p ${SHIM_DIR}`;
  await Bun.write(SHIM_DEST, await shimFile.text());
  await Bun.$`chmod +x ${SHIM_DEST}`;
  console.log(`✓ Hook shim installed to ${SHIM_DEST}`);

  await mergeClaudeHooks(SHIM_DEST);
  console.log(`✓ Claude hooks merged into ${CLAUDE_SETTINGS}`);

  console.log("\nRestart Claude Code for hook changes to take effect.");
}

async function runUninstall(): Promise<void> {
  console.log("Uninstalling claude-approval-server...\n");

  await removeClaudeHooks();
  console.log(`✓ Claude hooks removed from ${CLAUDE_SETTINGS}`);

  try {
    await Bun.$`rm ${SHIM_DEST}`.quiet();
    console.log(`✓ Hook shim removed from ${SHIM_DEST}`);
  } catch {
    // Already gone
  }

  console.log("\nUninstall complete. Restart Claude Code for hook changes to take effect.");
}

async function checkHooksConfigured(): Promise<void> {
  try {
    const raw = await Bun.file(CLAUDE_SETTINGS).text();
    const settings = JSON.parse(raw) as ClaudeSettings;
    const hooks = settings.hooks ?? {};
    const hasAll =
      Array.isArray(hooks.PermissionRequest) &&
      Array.isArray(hooks.PostToolUse) &&
      Array.isArray(hooks.Stop) &&
      [hooks.PermissionRequest, hooks.PostToolUse, hooks.Stop].every((entries) =>
        (entries as HookEntry[]).some(
          (e) =>
            isHookEntry(e) &&
            e.hooks.some(
              (h) => typeof h.command === "string" && h.command.includes("claude-approval-server"),
            ),
        ),
      );

    if (!hasAll) {
      console.warn(
        "WARNING: Claude Code hooks are not configured. Run `claude-approval-server install-hooks` to configure them.",
      );
    }
  } catch {
    console.warn(
      "WARNING: Could not read ~/.claude/settings.json. Run `claude-approval-server install-hooks` to configure hooks.",
    );
  }
}

async function runInstallSwiftbar(): Promise<void> {
  let pluginsDir: string;
  try {
    const result = await Bun.$`defaults read com.ameba.SwiftBar PluginDirectory`.quiet();
    pluginsDir = result.stdout.toString().trim();
  } catch {
    console.error(
      "Error: SwiftBar plugins directory not found.\n" +
        "Is SwiftBar installed? Set a plugins folder in SwiftBar → Preferences → General.",
    );
    process.exit(1);
  }

  const scriptName = "claude-approval.30s.sh";
  const dest = join(pluginsDir, scriptName);
  const src = Bun.file(new URL(`../swiftbar/${scriptName}`, import.meta.url));
  await Bun.write(dest, await src.text());
  await Bun.$`chmod +x ${dest}`.quiet();
  console.log(`✓ SwiftBar plugin installed to ${dest}`);
  console.log(
    "\nRefresh SwiftBar plugins to activate (right-click the SwiftBar icon → Refresh All).",
  );
}

async function runServe(): Promise<void> {
  await checkHooksConfigured();
  await import("./index.ts");
}

async function runStatus(): Promise<void> {
  try {
    const resp = await fetch(`http://localhost:${PORT}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const body = (await resp.json()) as { pending: number; idle: number };
    console.log(`Server: running (pending=${body.pending}, idle=${body.idle})`);
  } catch {
    console.log("Server: not responding");
  }
}

async function runLogs(): Promise<void> {
  const proc = Bun.spawn(["tail", "-f", LOG_OUT, LOG_ERR], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  await proc.exited;
}

function printHelp(): void {
  console.log(`Usage: claude-approval-server <command>

Commands:
  serve             Start the server (used by brew services)
  install-hooks     Configure Claude Code hooks in ~/.claude/settings.json
  install-swiftbar  Install the SwiftBar plugin
  uninstall         Remove Claude Code hooks
  status            Show server status
  logs              Tail server logs`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const [, , cmd] = process.argv;
  switch (cmd) {
    case "serve":
      await runServe();
      break;
    case "install-hooks":
      await runInstallHooks();
      break;
    case "install-swiftbar":
      await runInstallSwiftbar();
      break;
    case "uninstall":
      await runUninstall();
      break;
    case "status":
      await runStatus();
      break;
    case "logs":
      await runLogs();
      break;
    default:
      printHelp();
  }
}
