import type { PendingEntry, IdleSession } from "./types";

export const AUTO_DENY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export const pendingRequests = new Map<string, PendingEntry>();
export const idleSessions = new Map<string, IdleSession>();
