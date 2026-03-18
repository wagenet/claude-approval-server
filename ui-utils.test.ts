import { test, expect, describe } from "bun:test";
import {
  badgeClass,
  shortCwd,
  langFromPath,
  splitPipedCommand,
  parseHeredoc,
  parseInterpreterCall,
  langFromInterpreter,
} from "./ui-utils";

describe("badgeClass", () => {
  test("Bash", () => expect(badgeClass("Bash")).toBe("badge-bash"));
  test("Write", () => expect(badgeClass("Write")).toBe("badge-write"));
  test("Edit", () => expect(badgeClass("Edit")).toBe("badge-edit"));
  test("ExitPlanMode", () => expect(badgeClass("ExitPlanMode")).toBe("badge-plan"));
  test("EnterPlanMode", () => expect(badgeClass("EnterPlanMode")).toBe("badge-plan"));
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
  test("non-interpreter command returns null", () => {
    expect(parseInterpreterCall("ls -la")).toBeNull();
  });
  test("script file without -c returns null", () => {
    expect(parseInterpreterCall("python3 script.py")).toBeNull();
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
