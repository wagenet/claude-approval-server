import hljs from "highlight.js";
import * as Diff from "diff";
import { marked } from "marked";
import "highlight.js/styles/github-dark.min.css";
import type { IdleSession, QueueItem, AskQuestion } from "./ui-types";
import {
  asString,
  badgeClass,
  shortCwd,
  langFromPath,
  getTerminalIcon,
  splitPipedCommand,
  parseHeredoc,
  parseInterpreterCall,
} from "./ui-utils";

const POLL_MS = 1000;
let AUTO_DENY_MS = 10 * 60 * 1000; // fallback until /config responds
const rendered = new Map<string, HTMLElement>();
const renderedIdle = new Map<string, HTMLElement>();

if (Notification.permission === "default") void Notification.requestPermission();

function notifInstructions(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) {
    return 'Open <a href="about:preferences#privacy" target="_blank">about:preferences#privacy</a>, click Settings next to Notifications, find <code>localhost:4759</code>, and set it to Allow.';
  }
  if (ua.includes("Safari") && !ua.includes("Chrome")) {
    return "Open Safari Preferences (⌘,) → Websites → Notifications, find <code>localhost</code>, and set it to Allow.";
  }
  // Chrome / Chromium
  return 'Open <a href="chrome://settings/content/notifications" target="_blank">chrome://settings/content/notifications</a>, find <code>localhost:4759</code>, and set it to Allow.';
}

function updateNotifBanner() {
  const banner = document.getElementById("notif-banner");
  if (!banner) return;
  if (Notification.permission === "denied") {
    banner.innerHTML = `Notifications are blocked. To fix: ${notifInstructions()} Then reload this page.`;
    banner.style.display = "";
  } else {
    banner.style.display = "none";
  }
}
updateNotifBanner();

let swReg: ServiceWorkerRegistration | null = null;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      swReg = reg;
    })
    .catch(() => {});
}

async function notify(title: string, body: string, opts: NotificationOptions = {}) {
  if (Notification.permission !== "granted") return;
  if (swReg) {
    await swReg.showNotification(title, { body, ...opts });
  } else {
    new Notification(title, { body, ...opts });
  }
}

fetch("/config")
  .then((r) => r.json())
  .then((cfg: { autoDenyMs: number }) => {
    AUTO_DENY_MS = cfg.autoDenyMs;
  })
  .catch(() => {});

function openPlanModal(item: QueueItem, decide: (decision: string) => void) {
  const modal = document.getElementById("plan-modal")!;
  const title = document.getElementById("plan-modal-title")!;
  const body = document.getElementById("plan-modal-body")!;
  // SAFETY: these IDs are defined in ui.html and always present as button elements
  const approveBtn = document.getElementById("plan-modal-approve") as HTMLButtonElement;
  const denyBtn = document.getElementById("plan-modal-deny") as HTMLButtonElement;
  const focusBtn = document.getElementById("plan-modal-focus") as HTMLButtonElement;
  const closeBtn = document.getElementById("plan-modal-close") as HTMLButtonElement;

  const plan = asString(item.tool_input?.plan);
  const firstLine = plan.split("\n").find((l) => l.trim()) ?? item.tool_name ?? "Plan";
  title.textContent = firstLine.replace(/^#+\s*/, "");
  // SAFETY: marked.parse returns string when called synchronously (no async option set)
  body.innerHTML = marked.parse(plan) as string;

  approveBtn.disabled = false;
  denyBtn.disabled = false;

  const ti = item.terminal_info;
  const hasFocusTarget = !!(ti?.iterm_session_id || ti?.ghostty_resources_dir || ti?.term_program);
  focusBtn.style.display = hasFocusTarget ? "" : "none";
  focusBtn.onclick = () => fetch(`/focus/${item.id}`, { method: "POST" });
  focusBtn.innerHTML = getTerminalIcon(ti) + "Focus";

  closeBtn.onclick = () => {
    modal.classList.remove("open");
  };

  modal.classList.add("open");

  approveBtn.onclick = async () => {
    approveBtn.disabled = true;
    denyBtn.disabled = true;
    modal.classList.remove("open");
    decide("allow");
  };

  denyBtn.onclick = async () => {
    approveBtn.disabled = true;
    denyBtn.disabled = true;
    modal.classList.remove("open");
    decide("deny");
  };
}

// Close modal on backdrop click (module scripts run after DOM is ready, no DOMContentLoaded needed)
document.getElementById("plan-modal")!.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    // SAFETY: currentTarget is the element the listener is attached to, always an HTMLElement
    (e.currentTarget as HTMLElement).classList.remove("open");
  }
});

function makeDiffBlock(item: QueueItem): { pre: HTMLElement; filePath: string } {
  const filePath = asString(item.tool_input?.file_path ?? item.tool_input?.path);
  const oldStr = asString(item.tool_input?.old_string);
  const newStr = asString(item.tool_input?.new_string);
  const pre = document.createElement("pre");
  pre.className = "diff-block";

  for (const part of Diff.diffLines(oldStr, newStr)) {
    const lines = part.value.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    for (const line of lines) {
      const span = document.createElement("span");
      if (part.added) {
        span.className = "diff-added";
        span.textContent = "+ " + line;
      } else if (part.removed) {
        span.className = "diff-removed";
        span.textContent = "- " + line;
      } else {
        span.className = "diff-context";
        span.textContent = "  " + line;
      }
      pre.appendChild(span);
      pre.appendChild(document.createTextNode("\n"));
    }
  }

  return { pre, filePath };
}

function parseEmbeddedJson(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          result[key] = JSON.parse(trimmed);
          continue;
        } catch {}
      }
    }
    result[key] = value;
  }
  return result;
}

function makeTwoPartBlock(
  header: string,
  body: string,
  lang: string,
): { pre: HTMLElement; filePath: string } {
  const wrapper = document.createElement("div");
  wrapper.className = "two-part-block";

  const makePart = (text: string, language: string): HTMLPreElement => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = `language-${language}`;
    code.textContent = text;
    pre.appendChild(code);
    hljs.highlightElement(code);
    return pre;
  };

  wrapper.appendChild(makePart(header, "bash"));
  wrapper.appendChild(makePart(body, lang));
  return { pre: wrapper, filePath: "" };
}

function makeCodeBlock(item: QueueItem): { pre: HTMLElement; filePath: string } {
  if (item.tool_name === "Edit") return makeDiffBlock(item);

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  let filePath = "";

  if (item.tool_name === "Bash") {
    const rawCmd = asString(item.tool_input?.command);
    const heredoc = parseHeredoc(rawCmd);
    const interp = !heredoc ? parseInterpreterCall(rawCmd) : null;
    const piped = !heredoc && !interp ? splitPipedCommand(rawCmd) : null;

    if (heredoc ?? interp) {
      const info = (heredoc ?? interp)!;
      return makeTwoPartBlock(info.header, info.body, info.lang);
    }

    code.className = "language-bash";
    code.textContent = piped
      ? piped.map((seg, i) => (i === 0 ? seg : `  | ${seg}`)).join(" \\\n")
      : rawCmd;
  } else if (item.tool_name === "Write") {
    filePath = asString(item.tool_input?.file_path ?? item.tool_input?.path);
    code.className = `language-${langFromPath(filePath)}`;
    code.textContent = asString(item.tool_input?.content);
  } else if (item.tool_name === "Read") {
    filePath = asString(item.tool_input?.file_path);
    const offset = item.tool_input?.offset;
    const limit = item.tool_input?.limit;
    const parts: string[] = [];
    if (typeof offset === "number") parts.push(`offset: ${offset}`);
    if (typeof limit === "number") parts.push(`limit: ${limit}`);
    code.className = "language-plaintext";
    code.textContent = parts.length > 0 ? parts.join("  ") : "(full file)";
  } else if (item.tool_name === "Glob") {
    filePath = asString(item.tool_input?.path);
    code.className = "language-plaintext";
    code.textContent = asString(item.tool_input?.pattern);
  } else if (item.tool_name === "Grep") {
    filePath = asString(item.tool_input?.path ?? item.tool_input?.glob);
    code.className = "language-plaintext";
    code.textContent = asString(item.tool_input?.pattern);
  } else if (item.tool_name === "WebFetch") {
    code.className = "language-plaintext";
    code.textContent = asString(item.tool_input?.url);
  } else if (item.tool_name === "WebSearch") {
    code.className = "language-plaintext";
    code.textContent = asString(item.tool_input?.query);
  } else {
    const display = item.tool_input ? parseEmbeddedJson(item.tool_input) : {};
    code.className = "language-json";
    code.textContent = JSON.stringify(display, null, 2);
  }

  pre.appendChild(code);
  hljs.highlightElement(code);
  return { pre, filePath };
}

function makeAskUserQuestionCard(item: QueueItem): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = item.id;

  const rawQuestions = item.tool_input?.questions;
  // SAFETY: server always sends questions as AskQuestion[]; Array.isArray guards against missing/null
  const questions: AskQuestion[] = Array.isArray(rawQuestions)
    ? (rawQuestions as AskQuestion[])
    : [];
  const sessionId = item.session_id ? String(item.session_id).slice(0, 8) + "…" : "—";

  const header = document.createElement("div");
  header.className = "card-header";
  header.innerHTML = `<span class="badge badge-question">Question</span><span class="session">${sessionId}</span>`;
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "ask-body";
  card.appendChild(body);

  for (const q of questions) {
    const section = document.createElement("div");
    section.className = "ask-section";

    const qHeader = document.createElement("div");
    qHeader.className = "ask-section-header";
    qHeader.textContent = q.header;

    const qText = document.createElement("div");
    qText.className = "ask-section-question";
    qText.textContent = q.question;

    section.appendChild(qHeader);
    section.appendChild(qText);

    for (const opt of q.options) {
      const row = document.createElement("div");
      row.className = "ask-option";
      const labelEl = document.createElement("span");
      labelEl.className = "ask-option-label";
      labelEl.textContent = opt.label;
      row.appendChild(labelEl);
      if (opt.description) {
        const desc = document.createElement("span");
        desc.className = "ask-option-desc";
        desc.textContent = opt.description;
        row.appendChild(desc);
      }
      section.appendChild(row);
    }

    body.appendChild(section);
  }

  async function dismiss() {
    focusBtn.disabled = true;
    dismissBtn.disabled = true;
    try {
      await fetch(`/decide/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "allow" }),
      });
      card.remove();
      rendered.delete(item.id);
      updateIdle();
    } catch {
      focusBtn.disabled = false;
      dismissBtn.disabled = false;
    }
  }

  const actions = document.createElement("div");
  actions.className = "actions";

  const focusBtn = document.createElement("button");
  focusBtn.className = "btn-allow";
  focusBtn.innerHTML = getTerminalIcon(item.terminal_info) + "Focus";
  focusBtn.addEventListener("click", () => fetch(`/focus/${item.id}`, { method: "POST" }));

  const dismissBtn = document.createElement("button");
  dismissBtn.className = "btn-deny";
  dismissBtn.textContent = "Dismiss";
  dismissBtn.addEventListener("click", () => dismiss());

  actions.appendChild(focusBtn);
  actions.appendChild(dismissBtn);
  card.appendChild(actions);

  return card;
}

function makeCard(item: QueueItem): HTMLElement {
  if (item.tool_name === "AskUserQuestion") return makeAskUserQuestionCard(item);
  const card = document.createElement("div");
  const isPlan = item.tool_name === "ExitPlanMode" || item.tool_name === "EnterPlanMode";
  card.className = isPlan ? "card card-plan" : "card";
  card.dataset.id = item.id;

  const sessionId = item.session_id ? String(item.session_id).slice(0, 8) + "…" : "—";

  const elapsed = () => {
    const remaining = Math.max(
      0,
      Math.floor((AUTO_DENY_MS - (Date.now() - item.enqueuedAt)) / 1000),
    );
    const m = Math.floor(remaining / 60);
    const sec = String(remaining % 60).padStart(2, "0");
    return `${m}:${sec} remaining`;
  };

  const cwdShort = shortCwd(item.cwd ?? "");
  const cwdFull = item.cwd ?? "";
  const ti = item.terminal_info;
  const hasFocusTarget = !!(ti?.iterm_session_id || ti?.ghostty_resources_dir || ti?.term_program);

  card.innerHTML = `
    <div class="card-header">
      <span class="badge ${badgeClass(item.tool_name)}">${item.tool_name ?? "unknown"}</span>
      ${cwdShort ? `<span class="cwd" title="${cwdFull}">${cwdShort}</span>` : ""}
      <span class="timer" data-enqueued="${item.enqueuedAt}">${elapsed()}</span>
      <span class="session">${sessionId}</span>
    </div>
    <div class="code-block-wrapper"></div>
    <div class="explanation" style="display:none"></div>
    <div class="actions">
      <button class="btn-allow">${isPlan ? "Review Plan…" : "Allow"}</button>
      <button class="btn-deny">Deny</button>
      <button class="btn-explain">Explain</button>
      <button class="btn-focus"${hasFocusTarget ? "" : ' style="display:none"'}>Focus</button>
    </div>
  `;

  const wrapper = card.querySelector(".code-block-wrapper")!;
  const { pre, filePath } = makeCodeBlock(item);
  if (filePath) {
    const label = document.createElement("div");
    label.className = "file-path";
    label.textContent = filePath;
    wrapper.appendChild(label);
  }
  wrapper.appendChild(pre);

  const allowBtn = card.querySelector<HTMLButtonElement>(".btn-allow")!;
  const denyBtn = card.querySelector<HTMLButtonElement>(".btn-deny")!;
  const explainBtn = card.querySelector<HTMLButtonElement>(".btn-explain")!;
  const explanationEl = card.querySelector<HTMLElement>(".explanation")!;

  if (item.explanation) {
    explanationEl.textContent = item.explanation;
    explanationEl.style.display = "";
    explainBtn.style.display = "none";
  }

  async function decide(decision: string) {
    allowBtn.disabled = true;
    denyBtn.disabled = true;
    try {
      await fetch(`/decide/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      card.remove();
      rendered.delete(item.id);
      updateIdle();
    } catch {
      allowBtn.disabled = false;
      denyBtn.disabled = false;
    }
  }

  allowBtn.addEventListener("click", () => {
    if (isPlan) {
      openPlanModal(item, decide);
    } else {
      void decide("allow");
    }
  });
  denyBtn.addEventListener("click", () => void decide("deny"));

  explainBtn.addEventListener("click", async () => {
    explainBtn.disabled = true;
    explainBtn.textContent = "Explaining…";
    try {
      const res = await fetch(`/explain/${item.id}`);
      // SAFETY: /explain/:id always returns { explanation?, error? }
      const body = (await res.json()) as { explanation?: string; error?: string };
      explanationEl.textContent = res.ok ? body.explanation! : `Error: ${body.error}`;
      explanationEl.style.display = "";
      if (res.ok) {
        explainBtn.style.display = "none";
        return;
      }
    } catch (e) {
      explanationEl.textContent = `Error: ${String(e)}`;
      explanationEl.style.display = "";
    }
    explainBtn.textContent = "Explain";
    explainBtn.disabled = false;
  });

  const focusBtn = card.querySelector<HTMLButtonElement>(".btn-focus")!;
  focusBtn.innerHTML = getTerminalIcon(ti) + "Focus";
  focusBtn.addEventListener("click", async () => {
    await fetch(`/focus/${item.id}`, { method: "POST" });
  });

  const timerEl = card.querySelector<HTMLElement>(".timer")!;
  const interval = setInterval(() => {
    if (!card.isConnected) {
      clearInterval(interval);
      return;
    }
    timerEl.textContent = elapsed();
  }, 1000);

  return card;
}

function makeIdleCard(session: IdleSession): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";

  const sid = session.sessionId.slice(0, 8) + "…";
  const when = new Date(session.idleSince).toLocaleTimeString();
  const ti = session.terminal_info;
  const hasFocusTarget = !!(ti?.iterm_session_id || ti?.ghostty_resources_dir || ti?.term_program);
  const cwdShort = shortCwd(session.cwd ?? "");
  const cwdFull = session.cwd ?? "";

  card.innerHTML = `
    <div class="card-header">
      <span class="badge badge-idle">Idle</span>
      ${cwdShort ? `<span class="cwd" title="${cwdFull}">${cwdShort}</span>` : ""}
      <span class="session">${sid}</span>
    </div>
    <div class="idle-time">${when}</div>
    <div class="idle-output" style="display:block">Loading…</div>
    <div class="actions">
      <button class="btn-dismiss">Dismiss</button>
      <button class="btn-focus"${hasFocusTarget ? "" : ' style="display:none"'}>Focus</button>
    </div>
  `;

  const outputEl = card.querySelector<HTMLElement>(".idle-output")!;

  if (!session.transcriptPath) {
    outputEl.textContent = "No transcript available";
  } else {
    fetch(`/idle/${session.sessionId}/output`)
      .then((r) => r.json())
      .then((body: { output?: string; error?: string }) => {
        if (body.output) {
          outputEl.innerHTML = marked.parse(body.output) as string;
        } else {
          outputEl.textContent = "No output available";
        }
      })
      .catch(() => {
        outputEl.textContent = "Failed to load output";
      });
  }

  card.querySelector(".btn-dismiss")!.addEventListener("click", async () => {
    await fetch(`/idle/${session.sessionId}`, { method: "DELETE" });
    card.remove();
    renderedIdle.delete(session.sessionId);
    updateIdleEmptyState();
  });

  const idleFocusBtn = card.querySelector<HTMLButtonElement>(".btn-focus")!;
  idleFocusBtn.innerHTML = getTerminalIcon(session.terminal_info) + "Focus";
  idleFocusBtn.addEventListener("click", async () => {
    await fetch(`/focus-idle/${session.sessionId}`, { method: "POST" });
  });

  return card;
}

function updateIdleEmptyState() {
  const list = document.getElementById("idle-list")!;
  const empty = document.getElementById("idle-empty")!;
  const hasCards = list.children.length > 0;
  empty.style.display = hasCards ? "none" : "";
  list.style.display = hasCards ? "flex" : "none";
}

function updateIdle() {
  const q = document.getElementById("queue")!;
  const idle = document.getElementById("idle")!;
  const hasCards = q.children.length > 0;
  idle.style.display = hasCards ? "none" : "";
  q.style.display = hasCards ? "flex" : "none";
}

async function poll() {
  try {
    // SAFETY: /queue always returns QueueItem[]
    const items = (await fetch("/queue").then((r) => r.json())) as QueueItem[];
    const q = document.getElementById("queue")!;
    const currentIds = new Set(items.map((i) => i.id));

    for (const [id, card] of rendered) {
      if (!currentIds.has(id)) {
        card.remove();
        rendered.delete(id);
      }
    }

    for (const item of items) {
      if (!rendered.has(item.id)) {
        const card = makeCard(item);
        q.append(card);
        rendered.set(item.id, card);
        void notify(
          `Claude needs approval: ${item.tool_name ?? "unknown"}`,
          shortCwd(item.cwd ?? ""),
          { requireInteraction: true },
        );
      }
    }

    updateIdle();
  } catch {
    // server unreachable, ignore
  }
}

async function pollIdle() {
  try {
    // SAFETY: /idle always returns IdleSession[]
    const sessions = (await fetch("/idle").then((r) => r.json())) as IdleSession[];
    const list = document.getElementById("idle-list")!;
    const currentIds = new Set(sessions.map((s) => s.sessionId));

    for (const [id, card] of renderedIdle) {
      if (!currentIds.has(id)) {
        card.remove();
        renderedIdle.delete(id);
      }
    }

    for (const session of sessions) {
      if (!renderedIdle.has(session.sessionId)) {
        const card = makeIdleCard(session);
        list.append(card);
        renderedIdle.set(session.sessionId, card);
        void notify("Claude session idle", shortCwd(session.cwd ?? ""));
      }
    }

    updateIdleEmptyState();
  } catch {
    // server unreachable, ignore
  }
}

void poll();
setInterval(poll, POLL_MS);
void pollIdle();
setInterval(pollIdle, POLL_MS);
