#!/bin/bash
# <xbar.title>Claude Approval</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.desc>Shows pending Claude Code approval requests and opens the approval UI.</xbar.desc>
# <xbar.dependencies>curl</xbar.dependencies>
# <swiftbar.persistentWebView>true</swiftbar.persistentWebView>
# <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>
# <xbar.var>string(PORT="4759"): Server port (dev is typically 4200)</xbar.var>

PORT="${PORT:-4759}"
SERVER="http://127.0.0.1:$PORT"

HEALTH=$(curl -s --max-time 2 "$SERVER/health" 2>/dev/null)
PENDING=$(echo "$HEALTH" | grep -o '"pending":[0-9]*' | grep -o '[0-9]*')
if [ -z "$PENDING" ] || ! [[ "$PENDING" =~ ^[0-9]+$ ]]; then
  PENDING=0
fi

PARAMS="sfimage=asterisk href='$SERVER' webview=true webvieww=440 webviewh=700"

BADGE_CIRCLES=("" "❶" "❷" "❸" "❹" "❺" "❻" "❼" "❽" "❾" "❿" \
               "⓫" "⓬" "⓭" "⓮" "⓯" "⓰" "⓱" "⓲" "⓳" "⓴")

BADGE=""
if [ "$PENDING" -gt 0 ]; then
  if [ "$PENDING" -le "${#BADGE_CIRCLES[@]}" ]; then
    BADGE="${BADGE_CIRCLES[$PENDING]}"
  else
    BADGE="⏺"
  fi
fi

echo "$BADGE | $PARAMS"
