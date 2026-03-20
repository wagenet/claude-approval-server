---
description: Bun server with Ember 6 frontend. Use pnpm for frontend/, bun for everything else.
alwaysApply: true
---

## Project overview

This is a Claude Code approval server. It intercepts Claude's `PermissionRequest` hook, holds the connection open (up to 10 min), and lets the user approve/deny via a web UI at `http://localhost:4759`. Browser notifications alert the user to new items; clicking a notification focuses the tab.

**Files:**

- `index.ts` — Bun HTTP server (all state is in-memory; no database); serves `frontend/dist/` in dev, embedded bundle in binary
- `frontend/` — Ember 6 + Embroider + Vite app (GTS strict mode); built with `pnpm --dir frontend build`
- `hook-shim.sh` — Bash shim invoked by Claude Code hooks; enriches payload with terminal env vars and forwards to the server via `curl`
- `cli.ts` — CLI entry point; `serve` subcommand starts the server (used by `brew services`)
- `scripts/embed-frontend.ts` — run after `vite build`; generates `frontend-bundle.generated.ts` so `bun build --compile` embeds all frontend assets

**External runtime dependencies** (not in package.json):

- `jq`, `curl` — used in `hook-shim.sh`
- `osascript` — used for terminal focus (AppleScript)
- `claude` CLI — `/explain/:id` spawns `claude -p ... --model haiku` as a subprocess

**Running:**

- Dev (both servers): `bun run dev` — starts Bun API on `:4759` and Vite on `:5173` (proxy to Bun) via concurrently
- Dev (API only): `bun --hot index.ts`
- Dev (frontend only): `pnpm --dir frontend start`
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

Default to using Bun instead of Node.js for server-side code. Use pnpm for the `frontend/` package.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` (root package)
- Use `bun run <script>` instead of `npm run <script>` (root package)
- Use `pnpm` for anything inside `frontend/`
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

The frontend is an Ember 6 app in `frontend/` using Embroider + Vite and GTS strict mode. Do not replace it with a Bun HTML import.

**Structure:**

- `frontend/app/services/` — `approval-queue.ts` (1s polling, notifications), `app-settings.ts` (theme/config)
- `frontend/app/components/` — GTS components: `queue-card`, `ask-user-question-card`, `idle-session-card`, `code-block`, `diff-block`, `plan-modal`, `settings-modal`, `countdown-timer`, `terminal-icon`, `approval-queue`, `idle-sessions`
- `frontend/app/templates/application.gts` — root layout; injects services and starts polling in constructor
- `frontend/app/utils/ui-utils.ts` — pure formatting helpers (no DOM); `ui-types.ts` — shared types
- `frontend/app/utils/helpers.ts` — `eq` and other template helpers (`eq` is not exported by `@ember/helper` in v6.11)

**Commands:**

```sh
pnpm --dir frontend install   # install deps
pnpm --dir frontend start     # Vite dev server at :5173
pnpm --dir frontend build     # production build → frontend/dist/
```

**Production embedding:** Before `bun build --compile`, run `bun scripts/embed-frontend.ts` to generate `frontend-bundle.generated.ts` (gitignored). `index.ts` imports it at startup; if absent it falls back to serving `frontend/dist/` from disk.
