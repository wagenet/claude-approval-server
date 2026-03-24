import { test, expect, describe } from "bun:test";
import {
  stableStringify,
  buildExplainPrompt,
  buildFocusScript,
  allowResponse,
  denyResponse,
  findGitRoot,
} from "./utils";

describe("stableStringify", () => {
  test("primitives", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(1)).toBe("1");
    expect(stableStringify("hello")).toBe('"hello"');
    expect(stableStringify(true)).toBe("true");
  });

  test("sorts object keys", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  test("nested objects", () => {
    expect(stableStringify({ z: { b: 1, a: 2 }, a: 0 })).toBe('{"a":0,"z":{"a":2,"b":1}}');
  });

  test("arrays", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  test("array of objects", () => {
    expect(stableStringify([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });
});

describe("buildExplainPrompt", () => {
  test("Bash", () => {
    const prompt = buildExplainPrompt({ tool_name: "Bash", tool_input: { command: "ls -la" } });
    expect(prompt).toContain("ls -la");
    expect(prompt).toContain("```bash");
  });

  test("Edit", () => {
    const prompt = buildExplainPrompt({
      tool_name: "Edit",
      tool_input: { file_path: "foo.ts", old_string: "old", new_string: "new" },
    });
    expect(prompt).toContain("foo.ts");
    expect(prompt).toContain("old");
    expect(prompt).toContain("new");
  });

  test("Write truncates content at 3000 chars", () => {
    const content = "x".repeat(4000);
    const prompt = buildExplainPrompt({
      tool_name: "Write",
      tool_input: { file_path: "f.ts", content },
    });
    expect(prompt).toContain("x".repeat(3000));
    expect(prompt).not.toContain("x".repeat(3001));
  });

  test("unknown tool falls back to JSON", () => {
    const prompt = buildExplainPrompt({ tool_name: "Glob", tool_input: { pattern: "**/*.ts" } });
    expect(prompt).toContain("Glob");
    expect(prompt).toContain("pattern");
  });
});

describe("buildFocusScript", () => {
  test("iTerm2 with valid GUID", () => {
    const script = buildFocusScript({ terminal_info: { iterm_session_id: "prefix:ABCD-1234" } });
    expect(script).toContain("iTerm2");
    expect(script).toContain("ABCD-1234");
  });

  test("iTerm2 without GUID returns null", () => {
    const script = buildFocusScript({ terminal_info: { iterm_session_id: "nocolon" } });
    expect(script).toBeNull();
  });

  test("iTerm2 GUID with injection chars returns null", () => {
    const script = buildFocusScript({
      terminal_info: { iterm_session_id: 'prefix:ABCD" & do shell script "evil' },
    });
    expect(script).toBeNull();
  });

  test("Ghostty without cwd returns simple activate", () => {
    const script = buildFocusScript({
      terminal_info: { ghostty_resources_dir: "/opt/ghostty" },
      cwd: "",
    });
    expect(script).toBe('tell application "Ghostty" to activate');
  });

  test("Ghostty with cwd", () => {
    const script = buildFocusScript({
      terminal_info: { ghostty_resources_dir: "/opt/ghostty" },
      cwd: "/home/user/proj",
    });
    expect(script).toContain("Ghostty");
    expect(script).toContain("/home/user/proj");
    expect(script).toContain("activate window");
    expect(script).toContain("select tab");
    expect(script).toContain("tell trm to focus");
    expect(script).not.toContain("set index of w");
    expect(script).not.toContain("set selected of t");
  });

  test("VSCode without cwd returns simple activate", () => {
    const script = buildFocusScript({ terminal_info: { term_program: "vscode" }, cwd: "" });
    expect(script).toBe('tell application "Code" to activate');
  });

  test("VSCode with cwd", () => {
    const script = buildFocusScript({
      terminal_info: { term_program: "vscode" },
      cwd: "/Users/me/project",
    });
    expect(script).toContain("Visual Studio Code");
    expect(script).toContain("/Users/me/project");
  });

  test("Ghostty cwd with newline strips newline (prevents AppleScript injection)", () => {
    const script = buildFocusScript({
      terminal_info: { ghostty_resources_dir: "/opt/ghostty" },
      cwd: '/home/user/proj\nend tell\ndo shell script "evil"',
    });
    // Newline stripped so the injected AppleScript statements are not on separate lines
    expect(script).not.toContain("\nend tell\ndo shell script");
  });

  test("VSCode cwd with newline strips newline (prevents AppleScript injection)", () => {
    const script = buildFocusScript({
      terminal_info: { term_program: "vscode" },
      cwd: '/Users/me/project\ndo shell script "evil"',
    });
    expect(script).not.toContain("\ndo shell script");
  });

  test("unknown terminal returns null", () => {
    const script = buildFocusScript({ terminal_info: { term_program: "alacritty" } });
    expect(script).toBeNull();
  });

  test("no terminal_info returns null", () => {
    const script = buildFocusScript({});
    expect(script).toBeNull();
  });
});

describe("allowResponse / denyResponse", () => {
  test("allowResponse shape", () => {
    const r = allowResponse();
    expect(r.hookSpecificOutput.hookEventName).toBe("PermissionRequest");
    expect(r.hookSpecificOutput.decision.behavior).toBe("allow");
  });

  test("denyResponse default message", () => {
    const r = denyResponse();
    expect(r.hookSpecificOutput.decision.behavior).toBe("deny");
    expect(r.hookSpecificOutput.decision.message).toBe("Denied by user");
  });

  test("denyResponse custom message", () => {
    const r = denyResponse("nope");
    expect(r.hookSpecificOutput.decision.message).toBe("nope");
  });
});

describe("findGitRoot", () => {
  test("finds git root from cwd", () => {
    const root = findGitRoot(process.cwd());
    expect(root).toContain("claude-approval-server");
  });

  test("returns dir if no .git found", () => {
    const result = findGitRoot("/nonexistent/path/deep");
    expect(result).toBe("/nonexistent/path/deep");
  });
});
