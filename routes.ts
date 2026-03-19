import { randomUUID } from "crypto";
import type { PendingEntry, IdleSession } from "./types";
import { saveSettings, type Settings } from "./settings";
import { AUTO_DENY_TIMEOUT_MS, LOG_MAX, type LogEntry } from "./state";
import {
  asString,
  stableStringify,
  buildExplainPrompt,
  buildFocusScript,
  allowResponse,
  denyResponse,
  logRemoval,
  readSessionName,
} from "./utils";

function focusTerminal(entry: PendingEntry) {
  const script = buildFocusScript(entry.payload);
  if (!script) return;
  console.log("[focus] script:\n" + script);
  const proc = Bun.spawn(["osascript", "-e", script], { stdout: "pipe", stderr: "pipe" });
  proc.exited.then(async (code) => {
    const out = await new Response(proc.stdout).text();
    const err = await new Response(proc.stderr).text();
    console.log(`[focus] exit=${code} stdout=${JSON.stringify(out)} stderr=${JSON.stringify(err)}`);
  });
}

export function createRoutes(
  pending: Map<string, PendingEntry>,
  idleSessions: Map<string, IdleSession>,
  settings: Settings,
  log: LogEntry[],
) {
  return {
    "/config": {
      GET() {
        return Response.json(settings);
      },
      async PATCH(req: Request) {
        // SAFETY: /config PATCH body is a user-supplied Partial<Settings> from the settings UI
        const body = (await req.json()) as Partial<Settings>;
        if (typeof body.theme === "string" && (body.theme === "dark" || body.theme === "light"))
          settings.theme = body.theme;
        if (typeof body.notifEnabled === "boolean") settings.notifEnabled = body.notifEnabled;
        if (typeof body.notifRequireInteraction === "boolean")
          settings.notifRequireInteraction = body.notifRequireInteraction;
        await saveSettings();
        return Response.json(settings);
      },
    },

    "/queue": {
      GET() {
        const items = [...pending.entries()].map(
          ([id, { payload, enqueuedAt, explanation, sessionName }]) => ({
            id,
            enqueuedAt,
            explanation,
            ...payload,
            sessionName,
          }),
        );
        return Response.json(items);
      },
    },

    "/decide/:id": {
      async POST(req: Request & { params: { id: string } }) {
        const id = req.params.id;
        const entry = pending.get(id);
        if (!entry) {
          return Response.json({ error: "Not found or already decided" }, { status: 404 });
        }
        // SAFETY: /decide body is always { decision, message? } per the UI contract
        const body = (await req.json()) as { decision: string; message?: string };
        logRemoval(id, `web-ui:${body.decision}`, entry);
        pending.delete(id);
        entry.resolve(body.decision === "allow" ? "allow" : (body.message ?? body.decision));
        return Response.json({ ok: true });
      },
    },

    "/dismiss/:id": {
      POST(req: Request & { params: { id: string } }) {
        const id = req.params.id;
        const entry = pending.get(id);
        if (!entry) {
          return Response.json({ error: "Not found or already decided" }, { status: 404 });
        }
        logRemoval(id, "web-ui:dismiss", entry);
        pending.delete(id);
        entry.resolve("dismiss");
        return Response.json({ ok: true });
      },
    },

    "/focus/:id": {
      POST(req: Request & { params: { id: string } }) {
        const entry = pending.get(req.params.id);
        if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
        focusTerminal(entry);
        return Response.json({ ok: true });
      },
    },

    "/post-tool-use": {
      async POST(req: Request) {
        // SAFETY: /post-tool-use body is an arbitrary JSON object from the Claude hook
        const payload = (await req.json()) as Record<string, unknown>;
        const sessionId = asString(payload.session_id);
        const toolName = asString(payload.tool_name);

        const toolInput = stableStringify(payload.tool_input);
        for (const [id, entry] of pending) {
          if (
            entry.payload.session_id === sessionId &&
            entry.payload.tool_name === toolName &&
            stableStringify(entry.payload.tool_input) === toolInput
          ) {
            logRemoval(id, "post-tool-use", entry);
            pending.delete(id);
            entry.resolve("allow");
            break;
          }
        }

        return Response.json({ ok: true });
      },
    },

    "/explain/:id": {
      async GET(req: Request & { params: { id: string } }) {
        const entry = pending.get(req.params.id);
        if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
        if (entry.explaining)
          return Response.json({ error: "Already in progress" }, { status: 409 });
        if (entry.explanation) return Response.json({ explanation: entry.explanation });

        entry.explaining = true;
        try {
          const prompt = buildExplainPrompt(entry.payload);
          const proc = Bun.spawn(["claude", "-p", prompt, "--model", "haiku", "--effort", "low"], {
            stdout: "pipe",
            stderr: "pipe",
            env: { ...process.env, APPROVAL_SERVER_EXPLAIN: "1" },
          });
          const timeout = setTimeout(() => proc.kill(), 30_000);
          const [text, err] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
          ]);
          clearTimeout(timeout);
          if (!text.trim() && err.trim()) {
            console.error("[explain]", err.trim());
            return Response.json({ error: err.trim() }, { status: 500 });
          }
          entry.explanation = text.trim();
          return Response.json({ explanation: entry.explanation });
        } catch (e) {
          console.error("[explain]", e);
          return Response.json({ error: String(e) }, { status: 500 });
        } finally {
          entry.explaining = false;
        }
      },
    },

    "/health": {
      GET() {
        return Response.json({ ok: true, pending: pending.size, idle: idleSessions.size });
      },
    },

    "/stop": {
      async POST(req: Request) {
        // SAFETY: /stop body is a JSON object from the Claude PostToolUse hook
        const payload = (await req.json()) as Record<string, unknown>;
        const sessionId = asString(payload.session_id);
        const transcriptPath =
          typeof payload.transcript_path === "string" ? payload.transcript_path : undefined;
        const idleEntry: import("./types").IdleSession = {
          sessionId,
          idleSince: Date.now(),
          transcriptPath,
          payload,
        };
        idleSessions.set(sessionId, idleEntry);
        if (transcriptPath) {
          void readSessionName(transcriptPath).then((name) => {
            if (name) {
              const s = idleSessions.get(sessionId);
              if (s) s.sessionName = name;
            }
          });
        }
        console.log(`[stop] session=${sessionId}`);
        // Clear any pending entries for this session (e.g. last tool was CLI-denied)
        for (const [pendingId, entry] of pending) {
          if (entry.payload.session_id === sessionId) {
            logRemoval(pendingId, "session-idle", entry);
            pending.delete(pendingId);
            entry.resolve("deny");
          }
        }
        return Response.json({ ok: true });
      },
    },

    "/idle": {
      GET() {
        const items = [...idleSessions.values()].map(
          ({ sessionId, idleSince, transcriptPath, payload, sessionName }) => ({
            sessionId,
            idleSince,
            transcriptPath,
            terminal_info: payload.terminal_info,
            cwd: payload.cwd,
            sessionName,
          }),
        );
        return Response.json(items);
      },
    },

    "/idle/:id": {
      DELETE(req: Request & { params: { id: string } }) {
        const deleted = idleSessions.delete(req.params.id);
        return deleted
          ? Response.json({ ok: true })
          : Response.json({ error: "Not found" }, { status: 404 });
      },
    },

    "/idle/:id/output": {
      async GET(req: Request & { params: { id: string } }) {
        const session = idleSessions.get(req.params.id);
        if (!session) return Response.json({ error: "Not found" }, { status: 404 });
        if (!session.transcriptPath)
          return Response.json({ error: "No transcript" }, { status: 404 });
        try {
          const text = await Bun.file(session.transcriptPath).text();
          const lines = text.trim().split("\n").filter(Boolean);
          let lastText: string | null = null;
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              const msg = entry.message;
              if (msg?.role === "assistant" && Array.isArray(msg.content)) {
                const texts = msg.content
                  .filter((b: { type: string }) => b.type === "text")
                  .map((b: { text: string }) => b.text)
                  .join("");
                if (texts) lastText = texts;
              }
            } catch (e) {
              console.warn(`[transcript] skipping malformed line: ${String(e)}`);
            }
          }
          if (!lastText) return Response.json({ error: "No output found" }, { status: 404 });
          return Response.json({ output: lastText });
        } catch (e) {
          return Response.json({ error: String(e) }, { status: 500 });
        }
      },
    },

    "/focus-idle/:id": {
      POST(req: Request & { params: { id: string } }) {
        const session = idleSessions.get(req.params.id);
        if (!session) return Response.json({ error: "Not found" }, { status: 404 });
        const script = buildFocusScript(session.payload);
        if (script) {
          console.log("[focus-idle] script:\n" + script);
          const proc = Bun.spawn(["osascript", "-e", script], { stdout: "pipe", stderr: "pipe" });
          proc.exited.then(async (code) => {
            const out = await new Response(proc.stdout).text();
            const err = await new Response(proc.stderr).text();
            console.log(
              `[focus-idle] exit=${code} stdout=${JSON.stringify(out)} stderr=${JSON.stringify(err)}`,
            );
          });
        }
        return Response.json({ ok: true });
      },
    },

    "/log": {
      GET() {
        return Response.json(log);
      },
    },

    "/pending": {
      async POST(req: Request) {
        // SAFETY: /pending body is an arbitrary JSON object from the Claude PermissionRequest hook
        const payload = (await req.json()) as Record<string, unknown>;

        const id = randomUUID();
        let resolveDecision!: (decision: string) => void;
        const decisionPromise = new Promise<string>((resolve) => {
          resolveDecision = resolve;
        });

        // Auto-resolve any lingering entries for this session.
        // AskUserQuestion cards are informational — they don't block Claude, so we resolve them
        // with "allow" (a no-op) so the hook doesn't error. Any other pending tool for the same
        // session means Claude moved on without waiting for approval (CLI-denied or timed out),
        // so we resolve with "deny" to unblock the stream and clean up.
        const incomingSession =
          typeof payload.session_id === "string" ? payload.session_id : undefined;
        if (incomingSession) {
          idleSessions.delete(incomingSession);
          for (const [pendingId, entry] of pending) {
            if (entry.payload.session_id === incomingSession) {
              const isAskQuestion = entry.payload.tool_name === "AskUserQuestion";
              logRemoval(pendingId, isAskQuestion ? "new-session-activity" : "cli-denied", entry);
              pending.delete(pendingId);
              entry.resolve(isAskQuestion ? "allow" : "deny");
            }
          }
        }

        const entry: import("./types").PendingEntry = {
          resolve: resolveDecision,
          payload,
          enqueuedAt: Date.now(),
        };
        pending.set(id, entry);
        const transcriptPath =
          typeof payload.transcript_path === "string" ? payload.transcript_path : undefined;
        if (transcriptPath) {
          void readSessionName(transcriptPath).then((name) => {
            if (name) entry.sessionName = name;
          });
        }
        const toolName = asString(payload.tool_name, "unknown");
        log.push({
          id,
          timestamp: Date.now(),
          tool_name: toolName,
          tool_input: payload.tool_input,
        });
        if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
        const summary = JSON.stringify(payload.tool_input ?? "");
        console.log(`[enqueue] ${toolName} | ${summary.slice(0, 120)} | id=${id}`);

        setTimeout(() => {
          const entry = pending.get(id);
          if (entry) {
            logRemoval(id, "auto-deny-timeout", entry);
            pending.delete(id);
            resolveDecision("deny");
          }
        }, AUTO_DENY_TIMEOUT_MS);

        const encoder = new TextEncoder();
        let clientGone = false;

        const stream = new ReadableStream({
          start(controller) {
            void decisionPromise.then((decision) => {
              if (clientGone) return;
              try {
                if (decision === "dismiss") {
                  // Close without writing a body so the hook shim gets an empty response,
                  // causing curl to exit non-zero and Claude Code to fall through to its
                  // default CLI permission prompts.
                  controller.close();
                } else {
                  controller.enqueue(
                    encoder.encode(
                      JSON.stringify(
                        decision === "allow"
                          ? allowResponse()
                          : denyResponse(decision !== "deny" ? decision : undefined),
                      ),
                    ),
                  );
                  controller.close();
                }
              } catch {}
            });
          },
          cancel() {
            clientGone = true;
            const entry = pending.get(id);
            if (entry) {
              logRemoval(id, "stream-cancel", entry);
              pending.delete(id);
              resolveDecision("deny");
            }
          },
        });

        return new Response(stream, { headers: { "Content-Type": "application/json" } });
      },
    },
  };
}
