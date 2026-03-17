# claude-approval-server

HTTP approval server for Claude Code's `PreToolUse` hook. Blocks tool calls until approved or denied via a web UI.

## How it works

1. Claude Code fires a `PreToolUse` HTTP hook to `POST /pending`
2. The server holds the connection open, queuing the item
3. You approve or deny via the web UI at `http://localhost:4759`
4. The server responds to the hook, unblocking Claude

Read-only tools (`Read`, `Glob`, `Grep`, `LS`) and safe `Bash` patterns (`git status/log/diff`, `ls`, `echo`, `cat`) are auto-allowed and never reach the UI.

## Prerequisites

```sh
brew install vjeantet/tap/alerter
```

## Run (dev)

```sh
bun run index.ts
```

UI: http://localhost:4759
Health: http://localhost:4759/health

## Hook configuration

Already added to `~/.claude/settings.json`:

```json
"hooks": {
  "PermissionRequest": [{
    "hooks": [{ "type": "http", "url": "http://localhost:4759/pending", "timeout": 600 }]
  }],
  "PostToolUse": [{
    "hooks": [{ "type": "http", "url": "http://localhost:4759/post-tool-use", "timeout": 5 }]
  }]
}
```

`PermissionRequest` — Claude waits up to 10 minutes for approval. If the server is unreachable, Claude falls back to its normal approval prompt.

`PostToolUse` — fires after each tool runs. If the CLI approved a request inline (bypassing the web UI), this clears the stuck pending item automatically.

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

## Auto-allow rules

Defined in `index.ts` → `shouldAutoAllow()`. Tune this based on what actually hits the queue.

Current rules:
- Tools: `Read`, `Glob`, `Grep`, `LS`
- `Bash` commands matching: `git (status|log|diff|show)`, `ls `, `echo `, `cat `
