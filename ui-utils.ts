export function asString(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

export function parseMcpToolName(name: string): { server: string; tool: string } | null {
  const parts = name.split("__");
  if (parts.length < 3 || parts[0].toUpperCase() !== "MCP") return null;
  return {
    server: parts[1].toLowerCase(),
    tool: parts.slice(2).join("__").toLowerCase(),
  };
}

export function formatToolName(name: string | undefined): string {
  if (!name) return "unknown";
  const mcp = parseMcpToolName(name);
  if (mcp) {
    const toolStripped = mcp.tool.startsWith(mcp.server + "_")
      ? mcp.tool.slice(mcp.server.length + 1)
      : mcp.tool;
    return `${mcp.server} / ${toolStripped.replace(/_/g, " ")}`;
  }
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function badgeClass(toolName: string | undefined): string {
  if (toolName === "Bash") return "badge-bash";
  if (toolName === "Write") return "badge-write";
  if (toolName === "Edit") return "badge-edit";
  if (toolName === "ExitPlanMode" || toolName === "EnterPlanMode") return "badge-plan";
  if (toolName && parseMcpToolName(toolName)) return "badge-mcp";
  return "badge-default";
}

export function shortCwd(cwd: string): string {
  if (!cwd) return "";
  const parts = cwd.split("/").filter(Boolean);
  return parts.length <= 2 ? cwd : "…/" + parts.slice(-2).join("/");
}

export function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    py: "python",
    sh: "bash",
    bash: "bash",
    rb: "ruby",
    go: "go",
    rs: "rust",
    html: "html",
    css: "css",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    sql: "sql",
  };
  return map[ext] ?? "plaintext";
}

export interface EmbeddedCode {
  header: string;
  body: string;
  lang: string;
}

export type CommandSplit = { segments: string[]; seps: ("|" | "&&")[] };

/**
 * Split a bash command on top-level `|` and `&&` operators (not `||`, not `&`,
 * and not operators inside quotes or $(...) subshells).
 * Returns null when there is only one segment.
 */
export function splitCommand(cmd: string): CommandSplit | null {
  const segments: string[] = [];
  const seps: ("|" | "&&")[] = [];
  let current = "";
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    const next = i + 1 < cmd.length ? cmd[i + 1] : "";

    if (inSingle) {
      current += ch;
      if (ch === "'") inSingle = false;
    } else if (inDouble) {
      if (ch === '"') {
        inDouble = false;
        current += ch;
      } else if (ch === "$" && next === "(") {
        depth++;
        current += ch + next;
        i++;
      } else if (ch === ")" && depth > 0) {
        depth--;
        current += ch;
      } else {
        current += ch;
      }
    } else if (ch === "'") {
      inSingle = true;
      current += ch;
    } else if (ch === '"') {
      inDouble = true;
      current += ch;
    } else if (ch === "$" && next === "(") {
      depth++;
      current += ch + next;
      i++;
    } else if (ch === ")" && depth > 0) {
      depth--;
      current += ch;
    } else if (ch === "&" && next === "&" && depth === 0) {
      segments.push(current.trim());
      seps.push("&&");
      current = "";
      i++; // skip second &
    } else if (ch === "|" && depth === 0) {
      if (next === "|") {
        // || operator — do not split
        current += ch + next;
        i++;
      } else {
        segments.push(current.trim());
        seps.push("|");
        current = "";
      }
    } else {
      current += ch;
    }
  }
  segments.push(current.trim());

  const filtered = segments.filter((s) => s.length > 0);
  return filtered.length > 1 ? { segments: filtered, seps } : null;
}

/**
 * Split a bash command on top-level pipes only (not || and not pipes inside
 * quotes or $(...) subshells). Returns null when there is only one segment.
 */
export function splitPipedCommand(cmd: string): string[] | null {
  const result = splitCommand(cmd);
  if (!result) return null;
  // Only return if all separators are pipes
  if (result.seps.every((s) => s === "|")) return result.segments;
  return null;
}

/**
 * Detect a heredoc pattern: `cat > file << 'EOF'\n<body>\nEOF`
 * Returns the shell header line, the body, and the inferred language from the
 * file extension in the header. Returns null if not a heredoc.
 */
export function parseHeredoc(cmd: string): EmbeddedCode | null {
  const match = cmd.match(/^(.*?<<\s*['"]?(\w+)['"]?)\s*\n([\s\S]*?)\n\2\s*$/);
  if (!match) return null;
  const header = match[1].trim();
  const body = match[3];
  // Find the last filename-like token in the header for language detection
  const fileTokens = header.match(/\S+\.\w+/g);
  let lang: string;
  if (fileTokens) {
    lang = langFromPath(fileTokens[fileTokens.length - 1]);
  } else {
    const interpMatch = header.match(/\b(python3?|node|ruby|perl|bash|sh)\b/);
    lang = interpMatch ? langFromInterpreter(interpMatch[1]) : "plaintext";
  }
  return { header, body, lang };
}

/** Map an interpreter name to a highlight.js language string. */
export function langFromInterpreter(name: string): string {
  if (name.startsWith("python")) return "python";
  if (name === "node") return "javascript";
  if (name === "ruby") return "ruby";
  if (name === "perl") return "perl";
  return "bash";
}

/**
 * Detect an interpreter -c invocation: `python3 -c '...'` or `node -c "..."`.
 * Returns the shell header (everything up to and including -c), the inline
 * body, and the inferred language. Returns null if not matched.
 */
export function parseInterpreterCall(cmd: string): EmbeddedCode | null {
  const match = cmd.match(/^((python3?|node|ruby|perl|bash|sh)\b.*?-c)\s+(['"])([\s\S]*?)\3\s*$/);
  if (!match) return null;
  const header = match[1].trim();
  const interpreterName = match[2];
  const body = match[4];
  return { header, body, lang: langFromInterpreter(interpreterName) };
}

export interface GitCommitInfo {
  preamble: string; // shell commands with git commit -m "…"
  subject: string; // first line of commit message
  body: string; // body text (may be empty)
  trailers: string[]; // trailer lines like "Co-Authored-By: ..."
}

/**
 * Detect a `git commit -m "$(cat <<'EOF'…EOF\n)"` pattern.
 * Returns parsed commit info or null if not matched.
 */
export function parseGitCommit(cmd: string): GitCommitInfo | null {
  const match = cmd.match(/^([\s\S]*?<<\s*['"]?(\w+)['"]?)\s*\n([\s\S]*?)\n\2[ \t]*\n\)["']?\s*$/);
  if (!match) return null;

  const rawPreamble = match[1].trim();
  if (!/\bgit\s+commit\b/.test(rawPreamble)) return null;

  // Simplify preamble: replace everything after "git commit" on the last line
  const preamble = rawPreamble.replace(/(\bgit\s+commit\b).*$/, '$1 -m "…"');

  const lines = match[3].split("\n");
  const subject = lines[0] ?? "";

  const trailerRe = /^[A-Za-z][A-Za-z0-9-]*: .+/;
  const trailers: string[] = [];
  let i = lines.length - 1;
  while (i > 0 && lines[i].trim() === "") i--;
  while (i > 0 && trailerRe.test(lines[i])) {
    trailers.unshift(lines[i]);
    i--;
  }
  if (i > 0 && lines[i].trim() === "") i--;

  const body = lines
    .slice(1, i + 1)
    .join("\n")
    .trim();
  return { preamble, subject, body, trailers };
}

import type { TerminalInfo } from "./ui-types";

export function getTerminalIcon(ti: TerminalInfo | undefined): string {
  if (!ti) return "";
  const term = (ti.term_program ?? "").toLowerCase();
  if (term === "vscode") {
    return `<svg viewBox="0 0 128 128" width="14" height="14" style="flex-shrink:0" aria-hidden="true"><path fill="currentColor" d="M100.03 8.93L58.94 48.24 27.12 25.66 7.48 34.4v59.19l19.64 8.73 31.82-22.58 41.09 39.33 22.49-10.74V19.67L100.03 8.93zm.87 80.27L74.1 64l26.8-25.2v50.4z"/></svg>`;
  }
  if (ti.iterm_session_id || term === "iterm.app") {
    return `<svg viewBox="0 0 24 24" width="14" height="14" style="flex-shrink:0" aria-hidden="true"><path fill="currentColor" d="M24 5.359v13.282A5.36 5.36 0 0 1 18.641 24H5.359A5.36 5.36 0 0 1 0 18.641V5.359A5.36 5.36 0 0 1 5.359 0h13.282A5.36 5.36 0 0 1 24 5.359m-.932-.233A4.196 4.196 0 0 0 18.874.932H5.126A4.196 4.196 0 0 0 .932 5.126v13.748a4.196 4.196 0 0 0 4.194 4.194h13.748a4.196 4.196 0 0 0 4.194-4.194zm-.816.233v13.282a3.613 3.613 0 0 1-3.611 3.611H5.359a3.613 3.613 0 0 1-3.611-3.611V5.359a3.613 3.613 0 0 1 3.611-3.611h13.282a3.613 3.613 0 0 1 3.611 3.611M8.854 4.194v6.495h.962V4.194zM5.483 9.493v1.085h.597V9.48q.283-.037.508-.133.373-.165.575-.448.208-.284.208-.649a.9.9 0 0 0-.171-.568 1.4 1.4 0 0 0-.426-.388 3 3 0 0 0-.544-.261 32 32 0 0 0-.545-.209 1.8 1.8 0 0 1-.426-.216q-.164-.12-.164-.284 0-.223.179-.351.18-.126.485-.127.344 0 .575.105.239.105.5.298l.433-.5a2.3 2.3 0 0 0-.605-.433 1.6 1.6 0 0 0-.582-.159v-.968h-.597v.978a2 2 0 0 0-.477.127 1.2 1.2 0 0 0-.545.411q-.194.268-.194.634 0 .335.164.56.164.224.418.38a4 4 0 0 0 .552.262q.291.104.545.209.261.104.425.238a.39.39 0 0 1 .165.321q0 .225-.187.359-.18.134-.537.134-.381 0-.717-.134a4.4 4.4 0 0 1-.649-.351l-.388.589q.209.173.477.306.276.135.575.217.191.046.373.064"/></svg>`;
  }
  if (ti.ghostty_resources_dir || term === "ghostty") {
    return `<svg viewBox="0 0 24 24" width="14" height="14" style="flex-shrink:0" aria-hidden="true"><path fill="currentColor" d="M12 0C6.7 0 2.4 4.3 2.4 9.6v11.146c0 1.772 1.45 3.267 3.222 3.254a3.18 3.18 0 0 0 1.955-.686 1.96 1.96 0 0 1 2.444 0 3.18 3.18 0 0 0 1.976.686c.75 0 1.436-.257 1.98-.686.715-.563 1.71-.587 2.419-.018.59.476 1.355.743 2.182.699 1.705-.094 3.022-1.537 3.022-3.244V9.601C21.6 4.3 17.302 0 12 0M6.069 6.562a1 1 0 0 1 .46.131l3.578 2.065v.002a.974.974 0 0 1 0 1.687L6.53 12.512a.975.975 0 0 1-.976-1.687L7.67 9.602 5.553 8.38a.975.975 0 0 1 .515-1.818m7.438 2.063h4.7a.975.975 0 1 1 0 1.95h-4.7a.975.975 0 0 1 0-1.95"/></svg>`;
  }
  return "";
}
