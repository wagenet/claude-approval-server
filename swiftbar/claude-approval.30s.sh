#!/bin/bash
# <xbar.title>Claude Approval</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.desc>Shows pending Claude Code approval requests and opens the approval UI.</xbar.desc>
# <xbar.dependencies>curl,jq</xbar.dependencies>
# <swiftbar.persistentWebView>true</swiftbar.persistentWebView>
# <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>
# <xbar.var>string(PORT="4759"): Server port (dev is typically 4200)</xbar.var>

PORT="${PORT:-4759}"
SERVER="http://127.0.0.1:$PORT"

HEALTH=$(curl -s --max-time 2 "$SERVER/health" 2>/dev/null)
PENDING=$(echo "$HEALTH" | jq -r '.pending // 0' 2>/dev/null)
if [ -z "$PENDING" ] || ! [[ "$PENDING" =~ ^[0-9]+$ ]]; then
  PENDING=0
fi

PARAMS="href='$SERVER' webview=true webvieww=440 webviewh=700"
if [ "$PENDING" -gt 0 ]; then
  PARAMS="$PARAMS badge=$PENDING"
fi

echo "| sfimage=asterisk $PARAMS"
