import { test, expect, describe } from "bun:test";
import {
  badgeClass,
  parseMcpToolName,
  formatToolName,
  shortCwd,
  langFromPath,
  splitPipedCommand,
  splitCommand,
  parseHeredoc,
  parseInterpreterCall,
  langFromInterpreter,
  parseGitCommit,
} from "./ui-utils";

describe("parseMcpToolName", () => {
  test("standard MCP tool", () => {
    expect(parseMcpToolName("MCP__UNBLOCKED__UNBLOCKED_CONTEXT_ENGINE")).toEqual({
      server: "unblocked",
      tool: "unblocked_context_engine",
    });
  });
  test("lowercases server and tool", () => {
    expect(parseMcpToolName("MCP__EMBER__SEARCH_EMBER_DOCS")).toEqual({
      server: "ember",
      tool: "search_ember_docs",
    });
  });
  test("lowercase hook payload format", () => {
    expect(parseMcpToolName("mcp__unblocked__unblocked_context_engine")).toEqual({
      server: "unblocked",
      tool: "unblocked_context_engine",
    });
  });
  test("lowercase ember tool", () => {
    expect(parseMcpToolName("mcp__ember__search_ember_docs")).toEqual({
      server: "ember",
      tool: "search_ember_docs",
    });
  });
  test("returns null for non-MCP tool", () => {
    expect(parseMcpToolName("Bash")).toBeNull();
  });
  test("returns null for incomplete prefix", () => {
    expect(parseMcpToolName("MCP__ONLY_TWO")).toBeNull();
  });
});

describe("formatToolName", () => {
  test("MCP tool strips redundant server prefix and replaces underscores", () => {
    expect(formatToolName("MCP__UNBLOCKED__UNBLOCKED_CONTEXT_ENGINE")).toBe(
      "unblocked / context engine",
    );
  });
  test("lowercase hook payload format", () => {
    expect(formatToolName("mcp__unblocked__unblocked_context_engine")).toBe(
      "unblocked / context engine",
    );
  });
  test("MCP tool without redundant prefix", () => {
    expect(formatToolName("mcp__unblocked__data_retrieval")).toBe("unblocked / data retrieval");
  });
  test("ember MCP tool strips server prefix", () => {
    expect(formatToolName("mcp__ember__search_ember_docs")).toBe("ember / search ember docs");
  });
  test("PascalCase tool split into words", () => {
    expect(formatToolName("ExitPlanMode")).toBe("Exit Plan Mode");
  });
  test("single-word tool unchanged", () => {
    expect(formatToolName("Bash")).toBe("Bash");
  });
  test("undefined returns 'unknown'", () => {
    expect(formatToolName(undefined)).toBe("unknown");
  });
});

describe("badgeClass", () => {
  test("Bash", () => expect(badgeClass("Bash")).toBe("badge-bash"));
  test("Write", () => expect(badgeClass("Write")).toBe("badge-write"));
  test("Edit", () => expect(badgeClass("Edit")).toBe("badge-edit"));
  test("ExitPlanMode", () => expect(badgeClass("ExitPlanMode")).toBe("badge-plan"));
  test("EnterPlanMode", () => expect(badgeClass("EnterPlanMode")).toBe("badge-plan"));
  test("MCP tool uppercase", () =>
    expect(badgeClass("MCP__UNBLOCKED__UNBLOCKED_CONTEXT_ENGINE")).toBe("badge-mcp"));
  test("MCP tool lowercase", () =>
    expect(badgeClass("mcp__unblocked__unblocked_context_engine")).toBe("badge-mcp"));
  test("unknown defaults", () => expect(badgeClass("Glob")).toBe("badge-default"));
  test("undefined defaults", () => expect(badgeClass(undefined)).toBe("badge-default"));
});

describe("shortCwd", () => {
  test("empty string", () => expect(shortCwd("")).toBe(""));
  test("1 part", () => expect(shortCwd("/foo")).toBe("/foo"));
  test("2 parts", () => expect(shortCwd("/foo/bar")).toBe("/foo/bar"));
  test("3 parts truncates", () => expect(shortCwd("/a/b/c")).toBe("…/b/c"));
  test("deep path", () => expect(shortCwd("/a/b/c/d/e")).toBe("…/d/e"));
});

describe("langFromPath", () => {
  test("ts", () => expect(langFromPath("foo.ts")).toBe("typescript"));
  test("tsx", () => expect(langFromPath("app.tsx")).toBe("typescript"));
  test("js", () => expect(langFromPath("foo.js")).toBe("javascript"));
  test("py", () => expect(langFromPath("script.py")).toBe("python"));
  test("sh", () => expect(langFromPath("run.sh")).toBe("bash"));
  test("yaml", () => expect(langFromPath("config.yaml")).toBe("yaml"));
  test("yml", () => expect(langFromPath("config.yml")).toBe("yaml"));
  test("unknown extension", () => expect(langFromPath("file.xyz")).toBe("plaintext"));
  test("no extension", () => expect(langFromPath("Makefile")).toBe("plaintext"));
});

describe("splitPipedCommand", () => {
  test("three segments", () => {
    expect(splitPipedCommand("cat file.txt | grep pattern | sort")).toEqual([
      "cat file.txt",
      "grep pattern",
      "sort",
    ]);
  });
  test("two segments", () => {
    expect(splitPipedCommand("ls -la | head -20")).toEqual(["ls -la", "head -20"]);
  });
  test("single command returns null", () => {
    expect(splitPipedCommand("ls")).toBeNull();
  });
  test("|| operator not split", () => {
    expect(splitPipedCommand("cmd1 || cmd2")).toBeNull();
  });
  test("pipe inside double quotes not split", () => {
    expect(splitPipedCommand('echo "a|b"')).toBeNull();
  });
  test("pipe inside single quotes not split", () => {
    expect(splitPipedCommand("echo 'a|b'")).toBeNull();
  });
  test("pipe inside $(...) not split", () => {
    expect(splitPipedCommand("echo $(cat file | grep x)")).toBeNull();
  });
  test("top-level pipe after subshell is split", () => {
    expect(splitPipedCommand("echo $(cat file) | grep x")).toEqual(["echo $(cat file)", "grep x"]);
  });
});

describe("splitCommand", () => {
  test("pipe only", () => {
    expect(splitCommand("cat file | grep x")).toEqual({
      segments: ["cat file", "grep x"],
      seps: ["|"],
    });
  });
  test("&& only", () => {
    expect(splitCommand("cd /tmp && ls")).toEqual({
      segments: ["cd /tmp", "ls"],
      seps: ["&&"],
    });
  });
  test("mixed && and pipe", () => {
    expect(splitCommand("cd /path && git show origin/main | head -5")).toEqual({
      segments: ["cd /path", "git show origin/main", "head -5"],
      seps: ["&&", "|"],
    });
  });
  test("single command returns null", () => {
    expect(splitCommand("ls")).toBeNull();
  });
  test("|| not split", () => {
    expect(splitCommand("cmd1 || cmd2")).toBeNull();
  });
  test("& alone not split", () => {
    expect(splitCommand("sleep 10 & echo done")).toBeNull();
  });
  test("&& inside quotes not split", () => {
    expect(splitCommand('echo "a && b"')).toBeNull();
  });
  test("&& inside subshell not split", () => {
    expect(splitCommand("echo $(cd /tmp && ls)")).toBeNull();
  });
  test("top-level && after subshell is split", () => {
    expect(splitCommand("echo $(cd /tmp) && ls")).toEqual({
      segments: ["echo $(cd /tmp)", "ls"],
      seps: ["&&"],
    });
  });
  test("semicolon splits", () => {
    expect(splitCommand("cd /tmp; ls; echo done")).toEqual({
      segments: ["cd /tmp", "ls", "echo done"],
      seps: [";", ";"],
    });
  });
  test(";; not split", () => {
    expect(splitCommand("case $x in a) echo a;; b) echo b;; esac")).toBeNull();
  });
  test("; inside quotes not split", () => {
    expect(splitCommand('echo "a; b"')).toBeNull();
  });
});

describe("parseHeredoc", () => {
  test("python heredoc detects language", () => {
    const cmd = "cat > /tmp/patch.py << 'EOF'\nprint('hello')\nEOF";
    const result = parseHeredoc(cmd);
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("python");
    expect(result!.header).toBe("cat > /tmp/patch.py << 'EOF'");
    expect(result!.body).toBe("print('hello')");
  });
  test("typescript heredoc detects language", () => {
    const cmd = "cat > /tmp/foo.ts << EOF\nconst x = 1;\nEOF";
    const result = parseHeredoc(cmd);
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("typescript");
  });
  test("unknown extension falls back to plaintext", () => {
    const cmd = "cat > /tmp/foo.xyz << 'EOF'\nsome content\nEOF";
    const result = parseHeredoc(cmd);
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("plaintext");
  });
  test("plain bash command returns null", () => {
    expect(parseHeredoc("ls -la")).toBeNull();
  });
  test("piped command returns null", () => {
    expect(parseHeredoc("cat file | grep x")).toBeNull();
  });
  test("python3 interpreter heredoc detects python", () => {
    const result = parseHeredoc("python3 << 'EOF'\nprint('hello')\nEOF");
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("python");
  });
  test("compound command with python3 detects python", () => {
    const result = parseHeredoc("cd /some/dir && python3 << 'EOF'\nprint('hello')\nEOF");
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("python");
  });
  test("node interpreter heredoc detects javascript", () => {
    const result = parseHeredoc("node << EOF\nconsole.log(1)\nEOF");
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("javascript");
  });
});

describe("parseInterpreterCall", () => {
  test("python3 -c single quotes", () => {
    const result = parseInterpreterCall("python3 -c 'print(1)'");
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("python");
    expect(result!.header).toBe("python3 -c");
    expect(result!.body).toBe("print(1)");
  });
  test("python -c double quotes", () => {
    const result = parseInterpreterCall('python -c "import sys; print(sys.version)"');
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("python");
    expect(result!.body).toBe("import sys; print(sys.version)");
  });
  test("node -c", () => {
    const result = parseInterpreterCall("node -c 'console.log(1)'");
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("javascript");
  });
  test("ruby -c", () => {
    const result = parseInterpreterCall("ruby -c 'puts 1'");
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("ruby");
  });
  test("flags before -c included in header", () => {
    const result = parseInterpreterCall("python3 -u -c 'print(1)'");
    expect(result).not.toBeNull();
    expect(result!.header).toBe("python3 -u -c");
    expect(result!.body).toBe("print(1)");
  });
  test("node -e", () => {
    const result = parseInterpreterCall(`node -e "console.log(1)"`);
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("javascript");
    expect(result!.header).toBe("node -e");
    expect(result!.body).toBe("console.log(1)");
  });
  test("cd && node -e compound command", () => {
    const result = parseInterpreterCall(`cd /path && node -e "console.log('hi')"`);
    expect(result).not.toBeNull();
    expect(result!.header).toBe("cd /path && node -e");
    expect(result!.body).toBe("console.log('hi')");
    expect(result!.lang).toBe("javascript");
  });
  test("multiline node -e with cd prefix", () => {
    const result = parseInterpreterCall(
      `cd /path \\\n  && node -e "import('./x.js').then(m => {\n  console.log(m);\n})"`,
    );
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("javascript");
    expect(result!.body).toBe("import('./x.js').then(m => {\n  console.log(m);\n})");
  });
  test("non-interpreter command returns null", () => {
    expect(parseInterpreterCall("ls -la")).toBeNull();
  });
  test("script file without -c returns null", () => {
    expect(parseInterpreterCall("python3 script.py")).toBeNull();
  });
  test("trailing shell redirection and pipe", () => {
    const result = parseInterpreterCall(
      `python3 -c "import json\nprint(json.dumps({}))" 2>&1 | head -30`,
    );
    expect(result).not.toBeNull();
    expect(result!.lang).toBe("python");
    expect(result!.body).toBe("import json\nprint(json.dumps({}))");
  });
});

describe("parseGitCommit", () => {
  const TYPICAL = `git add ui.html ui.ts \\\n  && git commit -m "$(cat <<'EOF'\nfix(ui): make filename prominent\n\nSplit the path into dir and base.\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\nEOF\n)"`;

  test("parses subject, body, and trailer", () => {
    const result = parseGitCommit(TYPICAL);
    expect(result).not.toBeNull();
    expect(result!.subject).toBe("fix(ui): make filename prominent");
    expect(result!.body).toBe("Split the path into dir and base.");
    expect(result!.trailers).toEqual(["Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"]);
  });

  test("simplifies preamble", () => {
    const result = parseGitCommit(TYPICAL);
    expect(result!.preamble).toBe('git add ui.html ui.ts \\\n  && git commit -m "…"');
  });

  test("subject only (no body, no trailers)", () => {
    const cmd = `git commit -m "$(cat <<'EOF'\nchore: bump version\nEOF\n)"`;
    const result = parseGitCommit(cmd);
    expect(result).not.toBeNull();
    expect(result!.subject).toBe("chore: bump version");
    expect(result!.body).toBe("");
    expect(result!.trailers).toEqual([]);
  });

  test("regular heredoc (no git commit) returns null", () => {
    expect(parseGitCommit("cat > file.txt <<'EOF'\nhello\nEOF\n")).toBeNull();
  });

  test("plain bash command returns null", () => {
    expect(parseGitCommit("ls -la")).toBeNull();
  });

  test("body containing << heredoc syntax is still detected", () => {
    const cmd =
      `git add ui-utils.ts ui-utils.test.ts ui.html \\\n` +
      `  && git commit -m "$(cat <<'EOF'\n` +
      `feat(ui): detect interpreter in heredoc for syntax highlighting\n` +
      `\n` +
      `When a heredoc header has no filename extension (e.g. \`python3 << 'EOF'\`\n` +
      `or \`cd /dir && node << EOF\`), fall back to matching the interpreter name\n` +
      `using \`langFromInterpreter\` instead of defaulting to plaintext.\n` +
      `\n` +
      `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n` +
      `EOF\n` +
      `)"`;
    const result = parseGitCommit(cmd);
    expect(result).not.toBeNull();
    expect(result!.subject).toBe("feat(ui): detect interpreter in heredoc for syntax highlighting");
  });
});

describe("langFromInterpreter", () => {
  test("python3", () => expect(langFromInterpreter("python3")).toBe("python"));
  test("python", () => expect(langFromInterpreter("python")).toBe("python"));
  test("node", () => expect(langFromInterpreter("node")).toBe("javascript"));
  test("ruby", () => expect(langFromInterpreter("ruby")).toBe("ruby"));
  test("perl", () => expect(langFromInterpreter("perl")).toBe("perl"));
  test("bash", () => expect(langFromInterpreter("bash")).toBe("bash"));
  test("sh", () => expect(langFromInterpreter("sh")).toBe("bash"));
});
