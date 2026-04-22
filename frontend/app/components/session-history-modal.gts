import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type Owner from '@ember/owner';
import { formatToolName, badgeClass as getBadgeClass } from '../utils/ui-utils';
import type { RunLogEntry, QueueItem } from '../utils/ui-types';
import CodeBlock from './code-block';

interface Sig {
  Args: {
    sessionId: string;
    sessionName?: string;
    onClose: () => void;
  };
}

interface DisplayEntry {
  entry: RunLogEntry;
  key: string;
  time: string;
  badgeCls: string;
  toolLabel: string;
  sourceLabel: string;
  queueItem: QueueItem;
}

const REVIEWED_KEY = 'cas:reviewed';

function loadReviewed(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(REVIEWED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveReviewed(keys: ReadonlySet<string>): void {
  try {
    localStorage.setItem(REVIEWED_KEY, JSON.stringify([...keys]));
  } catch {
    // storage quota exceeded or private browsing — ignore
  }
}

function entryKey(entry: RunLogEntry): string {
  return `${entry.session_id}:${entry.timestamp}`;
}

function isReviewed(key: string, reviewedKeys: ReadonlySet<string>): boolean {
  return reviewedKeys.has(key);
}

export default class SessionHistoryModal extends Component<Sig> {
  @tracked displayEntries: DisplayEntry[] = [];
  @tracked isLoading = true;
  @tracked error: string | null = null;
  @tracked reviewedKeys: ReadonlySet<string> = loadReviewed();
  @tracked hideReviewed = false;

  constructor(owner: Owner, args: Sig['Args']) {
    super(owner, args);
    void this.loadHistory();
  }

  get visibleEntries(): DisplayEntry[] {
    if (!this.hideReviewed) return this.displayEntries;
    return this.displayEntries.filter((d) => !this.reviewedKeys.has(d.key));
  }

  get reviewedCount(): number {
    return this.displayEntries.filter((d) => this.reviewedKeys.has(d.key))
      .length;
  }

  async loadHistory() {
    try {
      const resp = await fetch(
        `/log?session_id=${encodeURIComponent(this.args.sessionId)}`
      );
      // SAFETY: /log always returns a JSON array; tool_input is an object on the wire
      // even though LogEntry.tool_input is typed as unknown on the server.
      const entries = (await resp.json()) as RunLogEntry[];
      this.displayEntries = [...entries].reverse().map((entry) => ({
        entry,
        key: entryKey(entry),
        time: new Date(entry.timestamp).toLocaleTimeString(),
        badgeCls: `badge ${getBadgeClass(entry.tool_name)}`,
        toolLabel: formatToolName(entry.tool_name),
        sourceLabel: entry.source === 'auto' ? 'Auto' : 'Approved',
        queueItem: {
          id: entryKey(entry),
          enqueuedAt: entry.timestamp,
          tool_name: entry.tool_name,
          // SAFETY: tool_input is always a JSON object at this boundary
          tool_input: entry.tool_input as Record<string, unknown>,
          session_id: entry.session_id,
        },
      }));
    } catch {
      this.error = 'Failed to load history.';
    } finally {
      this.isLoading = false;
    }
  }

  toggleReviewed = (key: string) => {
    const next = new Set(this.reviewedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    saveReviewed(next);
    this.reviewedKeys = next;
  };

  toggleHideReviewed = () => {
    this.hideReviewed = !this.hideReviewed;
  };

  backdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) this.args.onClose();
  };

  <template>
    {{! template-lint-disable no-invalid-interactive }}
    <div class="history-modal" role="dialog" {{on "click" this.backdropClick}}>
      {{! template-lint-enable no-invalid-interactive }}
      <div class="history-modal-inner">
        <div class="history-modal-header">
          <span class="history-modal-title">
            Session history{{#if @sessionName}} — {{@sessionName}}{{/if}}
          </span>
          {{#if this.reviewedCount}}
            <button
              type="button"
              class="btn-hide-reviewed"
              {{on "click" this.toggleHideReviewed}}
            >
              {{if this.hideReviewed "Show" "Hide"}}
              reviewed ({{this.reviewedCount}})
            </button>
          {{/if}}
          <button
            type="button"
            class="history-modal-close"
            {{on "click" @onClose}}
          >Close</button>
        </div>
        <div class="history-modal-body">
          {{#if this.isLoading}}
            <div class="history-loading">Loading…</div>
          {{else if this.error}}
            <div class="history-error">{{this.error}}</div>
          {{else if this.visibleEntries.length}}
            {{#each this.visibleEntries as |d|}}
              <div
                class={{if
                  (isReviewed d.key this.reviewedKeys)
                  "history-entry is-reviewed"
                  "history-entry"
                }}
              >
                <div class="history-entry-meta">
                  <span class={{d.badgeCls}}>{{d.toolLabel}}</span>
                  <span
                    class="history-entry-source history-source-{{d.entry.source}}"
                  >{{d.sourceLabel}}</span>
                  <span class="history-entry-time">{{d.time}}</span>
                  <button
                    type="button"
                    class={{if
                      (isReviewed d.key this.reviewedKeys)
                      "btn-mark-reviewed is-reviewed"
                      "btn-mark-reviewed"
                    }}
                    title={{if
                      (isReviewed d.key this.reviewedKeys)
                      "Mark unreviewed"
                      "Mark reviewed"
                    }}
                    {{on "click" (fn this.toggleReviewed d.key)}}
                  >✓</button>
                </div>
                <CodeBlock @item={{d.queueItem}} />
              </div>
            {{/each}}
          {{else if this.displayEntries.length}}
            <div class="history-empty">All entries hidden.
              <button
                type="button"
                class="btn-link"
                {{on "click" this.toggleHideReviewed}}
              >Show reviewed.</button></div>
          {{else}}
            <div class="history-empty">No history recorded for this session.</div>
          {{/if}}
        </div>
      </div>
    </div>
  </template>
}
