import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import CodeBlock from './code-block';
import CountdownTimer from './countdown-timer';
import TerminalIcon from './terminal-icon';
import { formatToolName, badgeClass, shortCwd } from '../utils/ui-utils';
import type { QueueItem } from '../utils/ui-types';
import type ApprovalQueueService from '../services/approval-queue';

interface Sig {
  Args: { item: QueueItem };
}

export default class QueueCard extends Component<Sig> {
  @service declare approvalQueue: ApprovalQueueService;

  @tracked isDeciding = false;
  @tracked explanation: string | null = null;
  @tracked isExplaining = false;

  get item() {
    return this.args.item;
  }

  get isPlan() {
    return (
      this.item.tool_name === 'ExitPlanMode' ||
      this.item.tool_name === 'EnterPlanMode'
    );
  }

  get cardClass() {
    return this.isPlan ? 'card card-plan' : 'card';
  }

  get badgeClass() {
    return `badge ${badgeClass(this.item.tool_name)}`;
  }

  get toolLabel() {
    return formatToolName(this.item.tool_name);
  }

  get cwdShort() {
    return shortCwd(this.item.cwd ?? '');
  }

  get sessionLabel() {
    return (
      this.item.sessionName ??
      (this.item.session_id
        ? String(this.item.session_id).slice(0, 8) + '…'
        : '—')
    );
  }

  get hasFocusTarget() {
    const ti = this.item.terminal_info;
    return !!(
      ti?.iterm_session_id ||
      ti?.ghostty_resources_dir ||
      ti?.term_program
    );
  }

  get allowLabel() {
    return this.isPlan ? 'Review Plan…' : 'Allow';
  }

  allow = async () => {
    if (this.isPlan) {
      this.approvalQueue.openPlanModal(this.item);
    } else {
      this.isDeciding = true;
      try {
        await this.approvalQueue.decide(this.item.id, 'allow');
      } finally {
        this.isDeciding = false;
      }
    }
  };

  deny = async () => {
    this.isDeciding = true;
    try {
      await this.approvalQueue.decide(this.item.id, 'deny');
    } finally {
      this.isDeciding = false;
    }
  };

  explain = async () => {
    this.isExplaining = true;
    try {
      const res = await fetch(`/explain/${this.item.id}`);
      const body = (await res.json()) as {
        explanation?: string;
        error?: string;
      };
      this.explanation = res.ok
        ? (body.explanation ?? '')
        : `Error: ${body.error}`;
    } catch (e) {
      this.explanation = `Error: ${String(e)}`;
    } finally {
      this.isExplaining = false;
    }
  };

  focus = () => {
    void fetch(`/focus/${this.item.id}`, { method: 'POST' });
  };

  dismiss = async () => {
    await this.approvalQueue.dismissQueueItem(this.item.id);
  };

  <template>
    <div class={{this.cardClass}}>
      <div class="card-header">
        <span class={{this.badgeClass}}>{{this.toolLabel}}</span>
        {{#if this.cwdShort}}
          <span class="cwd" title={{@item.cwd}}>{{this.cwdShort}}</span>
        {{/if}}
        <CountdownTimer
          @enqueuedAt={{@item.enqueuedAt}}
          @durationMs={{this.approvalQueue.autoDenyMs}}
        />
        <span class="session">{{this.sessionLabel}}</span>
        <button
          type="button"
          class="btn-x"
          aria-label="Dismiss"
          {{on "click" this.dismiss}}
        >✕</button>
      </div>

      <CodeBlock @item={{@item}} />

      {{#if this.explanation}}
        <div class="explanation visible">{{this.explanation}}</div>
      {{/if}}

      <div class="actions">
        <button
          type="button"
          class="btn-allow"
          disabled={{this.isDeciding}}
          {{on "click" this.allow}}
        >
          {{this.allowLabel}}
        </button>
        <button
          type="button"
          class="btn-deny"
          disabled={{this.isDeciding}}
          {{on "click" this.deny}}
        >
          Deny
        </button>
        {{#unless this.explanation}}
          <button
            type="button"
            class="btn-explain"
            disabled={{this.isExplaining}}
            {{on "click" this.explain}}
          >
            {{#if this.isExplaining}}Explaining…{{else}}Explain{{/if}}
          </button>
        {{/unless}}
        {{#if this.hasFocusTarget}}
          <button type="button" class="btn-focus" {{on "click" this.focus}}>
            <TerminalIcon @terminalInfo={{@item.terminal_info}} />Focus
          </button>
        {{/if}}
      </div>
    </div>
  </template>
}
