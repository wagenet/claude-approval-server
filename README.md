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

The hook shim (`hook-shim.sh`) captures terminal environment variables (`TERM_PROGRAM`, `ITERM_SESSION_ID`, `GHOSTTY_RESOURCES_DIR`) and includes them in the payload. The web UI shows a Focus button on each card that activates the originating terminal window via AppleScript. Supported terminals:

- **iTerm2** — focuses the exact session (tab + split) using the session's unique ID
- **Ghostty** (1.3+) — matches by working directory to find the right window/tab
- **VSCode** — uses `open -a` with the git root directory, which switches to the correct Space and window

**Session tracking:**

When a Claude session ends, the `Stop` hook fires. The server records the finished session and shows it in the **Idle Sessions** column of the web UI. Each card displays the final assistant output from the session transcript, a Focus button to return to the terminal, and a Dismiss button to clear the card.

**Settings:**

Click the ⚙ button in the top-right corner to open Settings. You can choose between dark and light themes, and toggle whether approval notifications stay on screen until dismissed. Settings are saved to `settings.json` and persist across restarts.

## Prerequisites

```sh
brew install jq
```

## Run (dev)

```sh
bun --hot index.ts
```

UI: http://localhost:4759
Health: http://localhost:4759/health

## Hook configuration

Add to `~/.claude/settings.json` (adjust the path to `hook-shim.sh`):

```json
"hooks": {
  "PermissionRequest": [{
    "hooks": [{
      "type": "command",
      "command": "/path/to/claude-approval-server/hook-shim.sh pending",
      "timeout": 600
    }]
  }],
  "PostToolUse": [{
    "hooks": [{
      "type": "command",
      "command": "/path/to/claude-approval-server/hook-shim.sh post-tool-use",
      "timeout": 5
    }]
  }],
  "Stop": [{
    "hooks": [{
      "type": "command",
      "command": "/path/to/claude-approval-server/hook-shim.sh stop"
    }]
  }]
}
```

The shim script reads the hook payload from stdin, injects terminal environment variables (for the Focus feature), and forwards to the server via `curl`.

`PermissionRequest` — Claude waits up to 10 minutes for approval. If the server is unreachable, Claude falls back to its normal approval prompt.

`PostToolUse` — fires after each tool runs. If you approved a request from the CLI prompt (bypassing the web UI), this clears the stale pending item from the queue automatically.

`Stop` — fires when a Claude session ends. The server records it in the Idle Sessions column until dismissed.

## Install as a persistent background service (launchd)

Copy the plist to the LaunchAgents directory and load it:

```sh
cp com.pwagenet.claude-approval.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pwagenet.claude-approval.plist
```

Check it's running:

```sh
launchctl list | grep claude-approval
curl http://localhost:4759/health
```

Logs:

- stdout: `/tmp/claude-approval.log`
- stderr: `/tmp/claude-approval.error.log`

### Stop / unload

```sh
launchctl unload ~/Library/LaunchAgents/com.pwagenet.claude-approval.plist
```

### Restart after changes

```sh
launchctl unload ~/Library/LaunchAgents/com.pwagenet.claude-approval.plist
cp com.pwagenet.claude-approval.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pwagenet.claude-approval.plist
```
