import { expect, test, describe } from "bun:test";
import { buildHookEntry, computeMergedHooks, computeRemovedHooks } from "./cli";

describe("buildHookEntry", () => {
  test("PermissionRequest has timeout 600", () => {
    const entry = buildHookEntry("PermissionRequest", "/shim.sh");
    expect(entry.hooks[0]).toMatchObject({ timeout: 600 });
    expect(entry.hooks[0].command).toContain("pending");
  });

  test("PostToolUse has timeout 5", () => {
    const entry = buildHookEntry("PostToolUse", "/shim.sh");
    expect(entry.hooks[0]).toMatchObject({ timeout: 5 });
    expect(entry.hooks[0].command).toContain("post-tool-use");
  });

  test("Stop has no timeout", () => {
    const entry = buildHookEntry("Stop", "/shim.sh");
    expect("timeout" in entry.hooks[0]).toBe(false);
    expect(entry.hooks[0].command).toContain("stop");
  });

  test("command includes shim path", () => {
    const entry = buildHookEntry(
      "PermissionRequest",
      "/home/user/.claude/claude-approval-server/hook-shim.sh",
    );
    expect(entry.hooks[0].command).toContain(
      "/home/user/.claude/claude-approval-server/hook-shim.sh",
    );
  });
});

describe("computeMergedHooks", () => {
  const shimPath = "/home/user/.claude/claude-approval-server/hook-shim.sh";

  test("adds all three hook types to empty settings", () => {
    const result = computeMergedHooks({}, shimPath);
    expect(result.hooks).toHaveProperty("PermissionRequest");
    expect(result.hooks).toHaveProperty("PostToolUse");
    expect(result.hooks).toHaveProperty("Stop");
  });

  test("is idempotent — running twice produces same result", () => {
    const once = computeMergedHooks({}, shimPath);
    const twice = computeMergedHooks(once, shimPath);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  test("updates existing entry in-place rather than appending", () => {
    const once = computeMergedHooks({}, shimPath);
    const twice = computeMergedHooks(once, shimPath);
    expect(twice.hooks!.PermissionRequest).toHaveLength(1);
  });

  test("preserves unrelated hooks", () => {
    const existing = {
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "my-other-tool.sh" }] }],
      },
    };
    const result = computeMergedHooks(existing, shimPath);
    expect(result.hooks!.SessionStart).toHaveLength(1);
    expect(result.hooks!.SessionStart[0].hooks[0].command).toBe("my-other-tool.sh");
  });

  test("preserves other top-level settings keys", () => {
    const existing = { model: "claude-opus-4-6", hooks: {} };
    const result = computeMergedHooks(existing, shimPath);
    expect(result.model).toBe("claude-opus-4-6");
  });

  test("updates shim path when it changes", () => {
    const oldShim = "/home/alice/.claude/claude-approval-server/hook-shim.sh";
    const newShim = "/home/bob/.claude/claude-approval-server/hook-shim.sh";
    const withOld = computeMergedHooks({}, oldShim);
    const withNew = computeMergedHooks(withOld, newShim);
    expect(withNew.hooks!.PermissionRequest).toHaveLength(1);
    expect(withNew.hooks!.PermissionRequest[0].hooks[0].command).toContain(newShim);
  });
});

describe("computeRemovedHooks", () => {
  const shimPath = "/home/user/.claude/claude-approval-server/hook-shim.sh";

  test("removes all approval-server hook entries", () => {
    const merged = computeMergedHooks({}, shimPath);
    const cleaned = computeRemovedHooks(merged);
    expect(cleaned.hooks).toBeUndefined();
  });

  test("preserves unrelated hooks", () => {
    const obj = {
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "other.sh" }] }],
        PermissionRequest: [
          {
            matcher: "",
            hooks: [{ type: "command", command: `${shimPath} pending`, timeout: 600 }],
          },
        ],
      },
    };
    const cleaned = computeRemovedHooks(obj);
    expect(cleaned.hooks!.SessionStart).toHaveLength(1);
    expect(cleaned.hooks!.PermissionRequest).toBeUndefined();
  });

  test("is a no-op on empty settings", () => {
    const cleaned = computeRemovedHooks({});
    expect(cleaned).toEqual({});
  });

  test("removes hooks key entirely when all entries are removed", () => {
    const merged = computeMergedHooks({}, shimPath);
    const cleaned = computeRemovedHooks(merged);
    expect("hooks" in cleaned).toBe(false);
  });
});
