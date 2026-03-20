import { createRoutes } from "./routes";
import { pendingRequests, idleSessions, payloadLog, IDLE_SESSION_TTL_MS } from "./state";
import { settings } from "./settings";
import { logRemoval } from "./utils";

// In a compiled binary the frontend is embedded as base64 in this module.
// In dev (`bun --hot index.ts`) the file won't exist and we fall back to disk.
let bundle: Record<string, { mime: string; data: string }> | null = null;
try {
  const mod = await import("./frontend-bundle.generated");
  bundle = mod.frontendBundle;
} catch {
  // dev: serve from ./frontend/dist/ on disk
}

function serveFrontend(path: string): Response {
  const key = path === "/" ? "/index.html" : path;
  if (bundle) {
    const entry = bundle[key] ?? bundle["/index.html"];
    // SAFETY: data is base64 written by scripts/embed-frontend.ts from binary file reads
    return new Response(Buffer.from(entry.data, "base64"), {
      headers: { "Content-Type": entry.mime },
    });
  }
  // dev fallback
  const file = Bun.file(`./frontend/dist${key}`);
  return new Response(file);
}

const PORT = Number(process.env.PORT ?? 4759);

Bun.serve({
  port: PORT,
  idleTimeout: 0,
  routes: {
    ...createRoutes(pendingRequests, idleSessions, settings, payloadLog),
    "/*": (req) => {
      const { pathname } = new URL(req.url);
      return serveFrontend(pathname);
    },
  },
});

console.log(`Approval server listening on http://localhost:${PORT}`);

setInterval(() => {
  const cutoff = Date.now() - IDLE_SESSION_TTL_MS;
  for (const [id, session] of idleSessions) {
    if (session.idleSince < cutoff) {
      console.log(`[idle-expire] session=${id}`);
      idleSessions.delete(id);
    }
  }
}, 60_000);

function shutdown(signal: string) {
  console.log(`[shutdown] ${signal}: resolving ${pendingRequests.size} pending entries`);
  for (const [id, entry] of pendingRequests) {
    logRemoval(id, "shutdown", entry);
    pendingRequests.delete(id);
    entry.resolve("deny");
  }
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
