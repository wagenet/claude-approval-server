export interface PendingEntry {
  resolve: (decision: string) => void;
  payload: Record<string, unknown>;
  enqueuedAt: number;
  explanation?: string;
  explaining?: boolean;
  sessionName?: string;
}

export interface IdleSession {
  sessionId: string;
  idleSince: number;
  transcriptPath?: string;
  payload: Record<string, unknown>;
  sessionName?: string;
}

export interface TerminalInfo {
  term_program?: string;
  iterm_session_id?: string;
  ghostty_resources_dir?: string;
}
