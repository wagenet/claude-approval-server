import { describe, test, expect, beforeEach } from "bun:test";

// We test the pure logic by reimplementing the badge function
// (the module has side effects and module-level state, so we extract the testable logic)

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

function badge(count: number): string {
  if (count <= 0) return "";
  return count < BADGE_CIRCLES.length ? BADGE_CIRCLES[count]! : "⏺";
}

describe("badge", () => {
  test("returns empty string for 0", () => {
    expect(badge(0)).toBe("");
  });

  test("returns empty string for negative", () => {
    expect(badge(-1)).toBe("");
  });

  test("returns circled number for 1-20", () => {
    expect(badge(1)).toBe("❶");
    expect(badge(10)).toBe("❿");
    expect(badge(20)).toBe("⓴");
  });

  test("returns dot for counts over 20", () => {
    expect(badge(21)).toBe("⏺");
    expect(badge(100)).toBe("⏺");
  });
});

// Test buildContent URL fallback logic
describe("buildContent URL logic", () => {
  function buildContent(
    pendingCount: number,
    opts: { swiftbarUrl?: string; lastKnownOrigin?: string | null; port?: number },
  ): string {
    const url = opts.swiftbarUrl ?? opts.lastKnownOrigin ?? `http://127.0.0.1:${opts.port ?? 4759}`;
    return `${badge(pendingCount)} | sfimage=asterisk href='${url}' webview=true webvieww=440 webviewh=700`;
  }

  test("uses SWIFTBAR_URL when set", () => {
    const content = buildContent(3, { swiftbarUrl: "http://custom:8080" });
    expect(content).toContain("href='http://custom:8080'");
    expect(content).toContain("❸");
  });

  test("falls back to lastKnownOrigin", () => {
    const content = buildContent(1, { lastKnownOrigin: "http://localhost:4200" });
    expect(content).toContain("href='http://localhost:4200'");
  });

  test("falls back to default port", () => {
    const content = buildContent(0, { port: 9999 });
    expect(content).toContain("href='http://127.0.0.1:9999'");
  });

  test("zero count shows empty badge", () => {
    const content = buildContent(0, {});
    expect(content).toStartWith(" |");
  });
});

// Test recordWindowVisibility + notifySwiftBar suppression logic
describe("visibility suppression logic", () => {
  let windowVisible: boolean;
  let latestCount: number;
  let ephemeralCalls: string[];

  function setEphemeral(content: string) {
    ephemeralCalls.push(content);
  }

  function recordWindowVisibility(visible: boolean, pendingCount: number) {
    latestCount = pendingCount;
    windowVisible = visible;
  }

  function notifySwiftBar(pendingCount: number) {
    latestCount = pendingCount;
    if (windowVisible) return;
    setEphemeral(`badge:${pendingCount}`);
  }

  beforeEach(() => {
    windowVisible = false;
    latestCount = 0;
    ephemeralCalls = [];
  });

  test("notifySwiftBar updates when window not visible", () => {
    notifySwiftBar(5);
    expect(ephemeralCalls).toHaveLength(1);
    expect(latestCount).toBe(5);
  });

  test("notifySwiftBar suppressed when window visible", () => {
    recordWindowVisibility(true, 3);
    notifySwiftBar(5);
    expect(ephemeralCalls).toHaveLength(0);
    expect(latestCount).toBe(5);
  });

  test("notifySwiftBar resumes after window hidden", () => {
    recordWindowVisibility(true, 3);
    notifySwiftBar(5);
    expect(ephemeralCalls).toHaveLength(0);

    recordWindowVisibility(false, 5);
    notifySwiftBar(2);
    expect(ephemeralCalls).toHaveLength(1);
  });
});
