# claude-approval-server

Approval server for Claude Code hooks. Blocks tool calls until approved or denied, and tracks idle sessions so you can check whether more work is needed.

## How it works

**Approvals:**

1. Claude Code fires a `PermissionRequest` hook — a shell shim enriches the payload with terminal environment info and forwards it to `POST /pending`
2. The server holds the connection open (up to 10 minutes), queuing the item
3. A browser notification appears — clicking it focuses the web UI tab
4. The item appears in the web UI at `http://localhost:4759`, where you can approve/deny, request an AI explanation, or focus the originating terminal window
5. The server responds to the hook, unblocking Claude

You can still approve from Claude Code's own CLI prompt. When you do, the `PostToolUse` hook fires and the server automatically clears the stale pending item.

If no decision is made within 10 minutes, the request is auto-denied.

**AskUserQuestion:**

When Claude uses `AskUserQuestion`, the web UI shows the question text and available options as read-only context. Use **Focus** to bring the terminal forward and answer there, or **Dismiss** to acknowledge and clear the card. The card also clears automatically when the next tool call from that session arrives.

**Plan review (ExitPlanMode / EnterPlanMode):**

When Claude enters or exits plan mode, the web UI highlights the card and opens a full-screen modal showing the plan. Use **Approve Plan** to let Claude proceed or **Deny** to reject it.

**Terminal focus:**

The hook shim captures terminal environment variables (`TERM_PROGRAM`, `ITERM_SESSION_ID`, `GHOSTTY_RESOURCES_DIR`) and includes them in the payload. The web UI shows a Focus button on each card that activates the originating terminal window via AppleScript. Supported terminals:

- **iTerm2** — focuses the exact session (tab + split) using the session's unique ID
- **Ghostty** (1.3+) — matches by working directory to find the right window/tab
- **VSCode** — uses `open -a` with the git root directory, which switches to the correct Space and window

**Session tracking:**

When a Claude session ends, the `Stop` hook fires. The server records the finished session and shows it in the **Idle Sessions** column of the web UI. Each card displays the final assistant output from the session transcript, a Focus button to return to the terminal, and a Dismiss button to clear the card.

**Settings:**

Click the ⚙ button in the top-right corner to open Settings. You can choose between dark and light themes, toggle browser notifications on/off, and toggle whether approval notifications stay on screen until dismissed. Settings are saved to `settings.json` and persist across restarts.

## Prerequisites

```sh
brew install jq
```

## Install

```sh
brew tap wagenet/claude-approval-server https://github.com/wagenet/claude-approval-server
brew install claude-approval-server
brew services start claude-approval-server
```

Homebrew automatically configures Claude Code hooks during install. Restart Claude Code for hook changes to take effect.

The binary is self-contained — no bun or other runtime required.

## Update

```sh
brew upgrade claude-approval-server
brew services restart claude-approval-server
```

## Commands

```
claude-approval-server serve          Start the server (used by brew services)
claude-approval-server install-hooks  Configure Claude Code hooks in ~/.claude/settings.json (recovery)
claude-approval-server uninstall      Remove Claude Code hooks
claude-approval-server status         Show server status
claude-approval-server logs           Tail server logs
```

`install-hooks` is a recovery command — e.g., if you clear `~/.claude/settings.json`. Homebrew runs it automatically on install and upgrade.

## Logs

- stdout: `/tmp/claude-approval.log`
- stderr: `/tmp/claude-approval.error.log`

## Run (dev)

```sh
bun run dev
```

Starts the Bun API server on `:4759` and the Vite dev server on `:5173` (proxies API calls to Bun). Open http://localhost:5173 for hot-module reload during development.

To run the API server alone (e.g. when testing a production build):

```sh
bun --hot index.ts
```

UI: http://localhost:4759
Health: http://localhost:4759/health

## Hook configuration (reference)

Homebrew configures these hooks automatically via `post_install`. For reference, the entries added to `~/.claude/settings.json` are:

```json
"hooks": {
  "PermissionRequest": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "~/.claude/claude-approval-server/hook-shim.sh pending",
      "timeout": 600
    }]
  }],
  "PostToolUse": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "~/.claude/claude-approval-server/hook-shim.sh post-tool-use",
      "timeout": 5
    }]
  }],
  "Stop": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "~/.claude/claude-approval-server/hook-shim.sh stop"
    }]
  }]
}
```

`PermissionRequest` — Claude waits up to 10 minutes for approval. If the server is unreachable, Claude falls back to its normal approval prompt.

`PostToolUse` — fires after each tool runs. If you approved a request from the CLI prompt (bypassing the web UI), this clears the stale pending item from the queue automatically.

`Stop` — fires when a Claude session ends. The server records it in the Idle Sessions column until dismissed.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the release process and dev setup.
