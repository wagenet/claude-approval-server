export interface IdleSession {
  sessionId: string;
  idleSince: number;
  transcriptPath?: string;
  terminal_info?: TerminalInfo;
  cwd?: string;
  sessionName?: string;
}

export interface TerminalInfo {
  term_program?: string;
  iterm_session_id?: string;
  ghostty_resources_dir?: string;
}

export interface QueueItem {
  id: string;
  enqueuedAt: number;
  explanation?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  session_id?: string;
  cwd?: string;
  terminal_info?: TerminalInfo;
  sessionName?: string;
}

export interface AskOption {
  label: string;
  description?: string;
}
export interface AskQuestion {
  question: string;
  header: string;
  options: AskOption[];
  multiSelect: boolean;
}
