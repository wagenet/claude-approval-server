---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
alwaysApply: true
---

## Project overview

This is a Claude Code approval server. It intercepts Claude's `PermissionRequest` hook, holds the connection open (up to 10 min), and lets the user approve/deny via a web UI at `http://localhost:4759`. Browser notifications alert the user to new items; clicking a notification focuses the tab.

**Files:**

- `index.ts` — Bun HTTP server (all state is in-memory; no database)
- `ui.ts` — Frontend code bundled via `ui.html`
- `hook-shim.sh` — Bash shim invoked by Claude Code hooks; enriches payload with terminal env vars and forwards to the server via `curl`
- `cli.ts` — CLI entry point; `serve` subcommand starts the server (used by `brew services`)

**External runtime dependencies** (not in package.json):

- `jq`, `curl` — used in `hook-shim.sh`
- `osascript` — used for terminal focus (AppleScript)
- `claude` CLI — `/explain/:id` spawns `claude -p ... --model haiku` as a subprocess

**Running:**

- Dev: `bun --hot index.ts`
- Production: managed via `brew services`; logs go to `/tmp/claude-approval.log`

**Releases:**

- Use conventional commits (`feat:`, `fix:`, `chore:`, `feat!:` for breaking). release-please reads these to determine version bump and generate the changelog.
- Merge conventional commits to main → release-please opens a "Release vX.Y.Z" PR → merge → binaries build and tap formula updates automatically.

**Key invariants:**

- `AUTO_DENY_TIMEOUT_MS` (10 min) must match the `timeout: 600` in Claude's hook config
- The `PostToolUse` hook fires after the user approves from the CLI, allowing stale pending items to self-clear via `/post-tool-use`
- `AskUserQuestion` cards auto-clear when the next tool call from the same session arrives

## Documentation

Keep `README.md` up to date whenever you make changes that affect:

- How the server works or what it does
- Setup / installation steps
- Hook configuration
- New features or removed features

## Claude Code Web

When running in Claude Code Web (`$CLAUDE_CODE_REMOTE=true`), take screenshots of the UI at `http://localhost:4759` and include them in pull request descriptions. Start the server with `bun index.ts &` before taking screenshots, then kill it after. Use the screenshot tool to capture the UI and embed the images in the PR body.

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## TypeScript

Prefer type guards over `as` casts when narrowing `unknown` values. Use `typeof` checks or a helper like:

```ts
function asString(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}
```

`as` casts are a last resort for cases where a type guard is not feasible. Any `as` cast must be preceded by a `// SAFETY:` comment explaining why it is sound.

## Linting and formatting

- `bun run lint` — oxlint with type-aware rules
- `bun run lint:fix` — auto-fix where possible
- `bun run format` — oxfmt
- `bun run format:check` — check only (used in CI)

Run `bun run lint` and `bun run format:check` before committing. CI enforces both.

## Testing

Write tests for new server-side logic. Run `bun test` after making changes to confirm nothing is broken.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.
