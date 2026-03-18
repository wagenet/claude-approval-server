import { createRoutes } from "./routes";
import { pendingRequests, idleSessions, AUTO_DENY_TIMEOUT_MS } from "./state";
import ui from "./ui.html";

const PORT = 4759;

Bun.serve({
  port: PORT,
  idleTimeout: 0,
  routes: {
    "/": ui,
    "/sw.js": () =>
      new Response(Bun.file("./sw.js"), {
        headers: { "Content-Type": "application/javascript; charset=utf-8" },
      }),
    ...createRoutes(pendingRequests, idleSessions, AUTO_DENY_TIMEOUT_MS),
  },
});

console.log(`Approval server listening on http://localhost:${PORT}`);
