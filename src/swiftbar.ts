const EPHEMERAL_NAME = "claude-approval";
const BADGE_CIRCLES = [
  "",
  "❶",
  "❷",
  "❸",
  "❹",
  "❺",
  "❻",
  "❼",
  "❽",
  "❾",
  "❿",
  "⓫",
  "⓬",
  "⓭",
  "⓮",
  "⓯",
  "⓰",
  "⓱",
  "⓲",
  "⓳",
  "⓴",
];

let enabled = false;
let port = 4759;
let windowVisible = false;
let latestCount = 0;
let lastKnownOrigin: string | null = null;

function badge(count: number): string {
  if (count <= 0) return "";
  return count < BADGE_CIRCLES.length ? BADGE_CIRCLES[count]! : "⏺";
}

function buildContent(pendingCount: number): string {
  const url = process.env.SWIFTBAR_URL ?? lastKnownOrigin ?? `http://127.0.0.1:${port}`;
  return `${badge(pendingCount)} | sfimage=asterisk href='${url}' webview=true webvieww=440 webviewh=700`;
}

function callSwiftBar(url: string): void {
  Bun.spawn(["open", url], { stdout: "pipe", stderr: "pipe" });
}

function setEphemeral(content: string): void {
  const url = `swiftbar://setephemeralplugin?name=${EPHEMERAL_NAME}&content=${encodeURIComponent(content)}`;
  callSwiftBar(url);
}

export async function initSwiftBar(serverPort: number): Promise<void> {
  const proc = Bun.spawn(["open", "-Ra", "SwiftBar"], { stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) {
    console.log("[swiftbar] not installed, skipping");
    return;
  }
  enabled = true;
  port = serverPort;
  console.log("[swiftbar] enabled");
  setEphemeral(buildContent(0));
}

// Called when the frontend reports a visibilitychange event.
export function recordWindowVisibility(
  visible: boolean,
  pendingCount: number,
  origin?: string,
): void {
  latestCount = pendingCount;
  windowVisible = visible;
  if (origin) lastKnownOrigin = origin;
  if (!enabled) return;
  if (!visible) {
    setTimeout(() => setEphemeral(buildContent(latestCount)), 300);
  }
}

// Called when the queue changes. Suppressed while the popup is open to avoid closing it.
export function notifySwiftBar(pendingCount: number): void {
  latestCount = pendingCount;
  if (!enabled) return;
  if (windowVisible) return;
  setEphemeral(buildContent(pendingCount));
}

export function cleanupSwiftBar(): void {
  if (!enabled) return;
  setEphemeral("");
}
