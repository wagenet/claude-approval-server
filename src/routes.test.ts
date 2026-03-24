import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createRoutes } from "./routes";
import type { Settings } from "./settings";
import type { PendingEntry, IdleSession } from "./types";

const testSettings: Settings = {
  theme: "dark",
  notifRequireInteraction: true,
};

function makeServer() {
  const pending = new Map<string, PendingEntry>();
  const idle = new Map<string, IdleSession>();
  const log: import("./state").LogEntry[] = [];
  const server = Bun.serve({
    port: 0,
    routes: createRoutes(pending, idle, testSettings, log),
  });
  return { server, pending, idle, log };
}

describe("GET /health", () => {
  let server: ReturnType<typeof Bun.serve>;

  beforeEach(() => {
    ({ server } = makeServer());
  });
  afterEach(() => server.stop(true));

  test("returns ok with counts", async () => {
    const res = await fetch(`http://localhost:${server.port}/health`);
    const body = (await res.json()) as { ok: boolean; pending: number; idle: number };
    expect(res.ok).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.pending).toBe(0);
    expect(body.idle).toBe(0);
  });
});

describe("GET /queue", () => {
  let server: ReturnType<typeof Bun.serve>;

  beforeEach(() => {
    ({ server } = makeServer());
  });
  afterEach(() => server.stop(true));

  test("returns empty array initially", async () => {
    const res = await fetch(`http://localhost:${server.port}/queue`);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

describe("POST /pending + POST /decide/:id", () => {
  let server: ReturnType<typeof Bun.serve>;
  let pending: Map<string, PendingEntry>;

  beforeEach(() => {
    ({ server, pending } = makeServer());
  });
  afterEach(() => server.stop(true));

  test("enqueues and resolves allow", async () => {
    const pendingRes = fetch(`http://localhost:${server.port}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "ls" },
        session_id: "sess1",
      }),
    });

    // Wait for it to appear in the queue
    await Bun.sleep(10);
    const id = pending.keys().next().value!;

    const decideRes = await fetch(`http://localhost:${server.port}/decide/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "allow" }),
    });
    expect(decideRes.ok).toBe(true);

    const response = await pendingRes;
    const body = (await response.json()) as {
      hookSpecificOutput: { decision: { behavior: string } };
    };
    expect(body.hookSpecificOutput.decision.behavior).toBe("allow");
    expect(pending.size).toBe(0);
  });

  test("resolves deny", async () => {
    const pendingRes = fetch(`http://localhost:${server.port}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "rm -rf /" },
        session_id: "sess2",
      }),
    });

    await Bun.sleep(10);
    const id = pending.keys().next().value!;

    await fetch(`http://localhost:${server.port}/decide/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "deny" }),
    });

    const response = await pendingRes;
    const body = (await response.json()) as {
      hookSpecificOutput: { decision: { behavior: string } };
    };
    expect(body.hookSpecificOutput.decision.behavior).toBe("deny");
  });

  test("auto-clears AskUserQuestion on new session activity", async () => {
    // Enqueue an AskUserQuestion
    const askRes = fetch(`http://localhost:${server.port}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_name: "AskUserQuestion", tool_input: {}, session_id: "sess3" }),
    });

    await Bun.sleep(10);
    expect(pending.size).toBe(1);

    // New tool call from same session auto-clears AskUserQuestion and adds Bash
    const bashRes = fetch(`http://localhost:${server.port}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "echo hi" },
        session_id: "sess3",
      }),
    });

    await Bun.sleep(10);
    // Only the Bash entry remains
    expect(pending.size).toBe(1);
    const [[, entry]] = [...pending.entries()];
    expect(entry.payload.tool_name).toBe("Bash");

    // AskUserQuestion was auto-resolved with allow
    const askBody = (await askRes.then((r) => r.json())) as {
      hookSpecificOutput: { decision: { behavior: string } };
    };
    expect(askBody.hookSpecificOutput.decision.behavior).toBe("allow");

    // Resolve the Bash entry to clean up before afterEach
    const bashId = pending.keys().next().value!;
    await fetch(`http://localhost:${server.port}/decide/${bashId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "allow" }),
    });
    await bashRes;
  });

  test("auto-clears stale non-AskUserQuestion entries on new session activity", async () => {
    // Enqueue a Bash entry (simulating a CLI-denied tool that left a stale entry)
    const bashRes = fetch(`http://localhost:${server.port}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "rm -rf /" },
        session_id: "sessA",
      }),
    });

    await Bun.sleep(10);
    expect(pending.size).toBe(1);

    // Next tool from same session clears the stale Bash entry and adds new one
    const writeRes = fetch(`http://localhost:${server.port}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "Write",
        tool_input: { path: "/tmp/x" },
        session_id: "sessA",
      }),
    });

    await Bun.sleep(10);
    expect(pending.size).toBe(1);
    const [[, entry]] = [...pending.entries()];
    expect(entry.payload.tool_name).toBe("Write");

    // Stale Bash entry was resolved with deny
    const bashBody = (await bashRes.then((r) => r.json())) as {
      hookSpecificOutput: { decision: { behavior: string } };
    };
    expect(bashBody.hookSpecificOutput.decision.behavior).toBe("deny");

    // Resolve the Write entry to clean up
    const writeId = pending.keys().next().value!;
    await fetch(`http://localhost:${server.port}/decide/${writeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "allow" }),
    });
    await writeRes;
  });

  test("forwards custom deny message to hook response", async () => {
    const pendingRes = fetch(`http://localhost:${server.port}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "rm -rf /" },
        session_id: "sess-deny-msg",
      }),
    });

    await Bun.sleep(10);
    const id = pending.keys().next().value!;

    await fetch(`http://localhost:${server.port}/decide/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "deny", message: "too risky" }),
    });

    const response = await pendingRes;
    const body = (await response.json()) as {
      hookSpecificOutput: { decision: { behavior: string; message: string } };
    };
    expect(body.hookSpecificOutput.decision.behavior).toBe("deny");
    expect(body.hookSpecificOutput.decision.message).toBe("too risky");
  });

  test("404 on unknown id", async () => {
    const res = await fetch(`http://localhost:${server.port}/decide/no-such-id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "allow" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /stop", () => {
  let server: ReturnType<typeof Bun.serve>;
  let pending: Map<string, PendingEntry>;
  let idle: Map<string, IdleSession>;

  beforeEach(() => {
    ({ server, pending, idle } = makeServer());
  });
  afterEach(() => server.stop(true));

  test("clears pending entries for the stopped session", async () => {
    const pendingRes = fetch(`http://localhost:${server.port}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "echo hi" },
        session_id: "sessStop",
      }),
    });

    await Bun.sleep(10);
    expect(pending.size).toBe(1);

    await fetch(`http://localhost:${server.port}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "sessStop" }),
    });

    expect(pending.size).toBe(0);
    expect(idle.has("sessStop")).toBe(true);

    // Stale pending entry was resolved with deny
    const body = (await pendingRes.then((r) => r.json())) as {
      hookSpecificOutput: { decision: { behavior: string } };
    };
    expect(body.hookSpecificOutput.decision.behavior).toBe("deny");
  });

  test("does not clear pending entries from other sessions", async () => {
    const pendingRes = fetch(`http://localhost:${server.port}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "echo hi" },
        session_id: "sessOther",
      }),
    });

    await Bun.sleep(10);
    expect(pending.size).toBe(1);

    await fetch(`http://localhost:${server.port}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "sessDifferent" }),
    });

    expect(pending.size).toBe(1);

    // Resolve to clean up
    const id = pending.keys().next().value!;
    await fetch(`http://localhost:${server.port}/decide/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "allow" }),
    });
    await pendingRes;
  });
});

describe("POST /post-tool-use", () => {
  let server: ReturnType<typeof Bun.serve>;
  let pending: Map<string, PendingEntry>;

  beforeEach(() => {
    ({ server, pending } = makeServer());
  });
  afterEach(() => server.stop(true));

  test("resolves matching pending entry", async () => {
    const payload = { tool_name: "Bash", tool_input: { command: "echo hi" }, session_id: "sess4" };

    const pendingRes = fetch(`http://localhost:${server.port}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    await Bun.sleep(10);
    expect(pending.size).toBe(1);

    await fetch(`http://localhost:${server.port}/post-tool-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    await pendingRes;
    expect(pending.size).toBe(0);
  });
});

describe("GET /idle/:id/output", () => {
  let server: ReturnType<typeof Bun.serve>;
  let idle: Map<string, IdleSession>;

  beforeEach(() => {
    ({ server, idle } = makeServer());
  });
  afterEach(() => server.stop(true));

  test("parses JSONL transcript and returns last assistant text", async () => {
    const tmpPath = `/tmp/test-transcript-${Date.now()}.jsonl`;
    const lines = [
      JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "hello" }] } }),
      JSON.stringify({
        message: { role: "assistant", content: [{ type: "text", text: "first response" }] },
      }),
      JSON.stringify({
        message: { role: "assistant", content: [{ type: "text", text: "final response" }] },
      }),
    ];
    await Bun.write(tmpPath, lines.join("\n"));

    idle.set("sess-output", {
      sessionId: "sess-output",
      idleSince: Date.now(),
      transcriptPath: tmpPath,
      payload: {},
    });

    const res = await fetch(`http://localhost:${server.port}/idle/sess-output/output`);
    const body = (await res.json()) as { output: string };
    expect(res.ok).toBe(true);
    expect(body.output).toBe("final response");
  });

  test("404 for unknown session", async () => {
    const res = await fetch(`http://localhost:${server.port}/idle/no-such/output`);
    expect(res.status).toBe(404);
  });
});

describe("GET /idle (cwd propagation)", () => {
  let server: ReturnType<typeof Bun.serve>;
  let idle: Map<string, IdleSession>;

  beforeEach(() => {
    ({ server, idle } = makeServer());
  });
  afterEach(() => server.stop(true));

  test("includes cwd from payload", async () => {
    idle.set("sess-cwd", {
      sessionId: "sess-cwd",
      idleSince: Date.now(),
      payload: { cwd: "/home/user/my-project", session_id: "sess-cwd" },
    });

    const res = await fetch(`http://localhost:${server.port}/idle`);
    const body = (await res.json()) as { sessionId: string; cwd?: string }[];
    expect(body).toHaveLength(1);
    expect(body[0].cwd).toBe("/home/user/my-project");
  });

  test("cwd is undefined when not in payload", async () => {
    idle.set("sess-nocwd", {
      sessionId: "sess-nocwd",
      idleSince: Date.now(),
      payload: { session_id: "sess-nocwd" },
    });

    const res = await fetch(`http://localhost:${server.port}/idle`);
    const body = (await res.json()) as { sessionId: string; cwd?: string }[];
    expect(body).toHaveLength(1);
    expect(body[0].cwd).toBeUndefined();
  });

  test("stop endpoint stores cwd from payload", async () => {
    await fetch(`http://localhost:${server.port}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "sess-stopcwd", cwd: "/projects/foo" }),
    });

    const res = await fetch(`http://localhost:${server.port}/idle`);
    const body = (await res.json()) as { sessionId: string; cwd?: string }[];
    expect(body).toHaveLength(1);
    expect(body[0].cwd).toBe("/projects/foo");
  });
});

describe("DELETE /idle/:id", () => {
  let server: ReturnType<typeof Bun.serve>;
  let idle: Map<string, IdleSession>;

  beforeEach(() => {
    ({ server, idle } = makeServer());
  });
  afterEach(() => server.stop(true));

  test("200 on success", async () => {
    idle.set("s1", { sessionId: "s1", idleSince: Date.now(), payload: {} });
    const res = await fetch(`http://localhost:${server.port}/idle/s1`, { method: "DELETE" });
    expect(res.ok).toBe(true);
    expect(idle.has("s1")).toBe(false);
  });

  test("404 on missing", async () => {
    const res = await fetch(`http://localhost:${server.port}/idle/nope`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
