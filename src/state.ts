import type { PendingEntry, IdleSession } from "./types";

export const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — must match Claude hook timeout
export const IDLE_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const pendingRequests = new Map<string, PendingEntry>();
export const idleSessions = new Map<string, IdleSession>();

export const LOG_MAX = 1000;

export type LogEntrySource = "approved" | "auto";

export interface LogEntry {
  timestamp: number;
  session_id: string;
  tool_name: string;
  tool_input: unknown;
  source: LogEntrySource;
}

export const payloadLog: LogEntry[] = [];
