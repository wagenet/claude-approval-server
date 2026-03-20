import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import TerminalIcon from './terminal-icon';
import type { QueueItem, AskQuestion } from '../utils/ui-types';
import type ApprovalQueueService from '../services/approval-queue';

interface Sig {
  Args: { item: QueueItem };
}

export default class AskUserQuestionCard extends Component<Sig> {
  @service declare approvalQueue: ApprovalQueueService;

  @tracked isDismissing = false;

  get sessionLabel() {
    const { item } = this.args;
    return (
      item.sessionName ??
      (item.session_id ? String(item.session_id).slice(0, 8) + '…' : '—')
    );
  }

  get questions(): AskQuestion[] {
    const raw = this.args.item.tool_input?.questions;
    // SAFETY: server always sends questions as AskQuestion[]; Array.isArray guards against missing/null
    return Array.isArray(raw) ? (raw as AskQuestion[]) : [];
  }

  get hasFocusTarget() {
    const ti = this.args.item.terminal_info;
    return !!(
      ti?.iterm_session_id ||
      ti?.ghostty_resources_dir ||
      ti?.term_program
    );
  }

  dismiss = async () => {
    this.isDismissing = true;
    try {
      await this.approvalQueue.decide(this.args.item.id, 'allow');
    } finally {
      this.isDismissing = false;
    }
  };

  focus = () => {
    void fetch(`/focus/${this.args.item.id}`, { method: 'POST' });
  };

  <template>
    <div class="card">
      <div class="card-header">
        <span class="badge badge-question">Question</span>
        <span class="session">{{this.sessionLabel}}</span>
      </div>

      <div class="ask-body">
        {{#each this.questions as |q|}}
          <div class="ask-section">
            <div class="ask-section-header">{{q.header}}</div>
            <div class="ask-section-question">{{q.question}}</div>
            {{#each q.options as |opt|}}
              <div class="ask-option">
                <span class="ask-option-label">{{opt.label}}</span>
                {{#if opt.description}}
                  <span class="ask-option-desc">{{opt.description}}</span>
                {{/if}}
              </div>
            {{/each}}
          </div>
        {{/each}}
      </div>

      <div class="actions">
        {{#if this.hasFocusTarget}}
          <button type="button" class="btn-allow" {{on "click" this.focus}}>
            <TerminalIcon @terminalInfo={{@item.terminal_info}} />Focus
          </button>
        {{/if}}
        <button
          type="button"
          class="btn-deny"
          disabled={{this.isDismissing}}
          {{on "click" this.dismiss}}
        >
          Dismiss
        </button>
      </div>
    </div>
  </template>
}
