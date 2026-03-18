#!/usr/bin/env bash
# Hook shim: enriches Claude Code hook payloads with terminal env vars,
# then forwards to the approval server via HTTP.
# Usage: hook-shim.sh <endpoint>  (e.g., "pending" or "post-tool-use")
# Requires: jq, curl

ENDPOINT="${1:-pending}"
PAYLOAD="$(cat)"

TERMINAL_INFO=$(jq -n \
  --arg term_program "${TERM_PROGRAM:-}" \
  --arg iterm_session_id "${ITERM_SESSION_ID:-}" \
  --arg ghostty_resources_dir "${GHOSTTY_RESOURCES_DIR:-}" \
  '{term_program: $term_program, iterm_session_id: $iterm_session_id, ghostty_resources_dir: $ghostty_resources_dir}')

ENRICHED=$(echo "$PAYLOAD" | jq --argjson ti "$TERMINAL_INFO" --arg cwd "${PWD:-}" '. + {terminal_info: $ti} | if (.cwd == null or .cwd == "") then . + {cwd: $cwd} else . end')

curl -sS --max-time 610 \
  -X POST -H 'Content-Type: application/json' \
  -d "$ENRICHED" \
  "http://localhost:4759/$ENDPOINT"
