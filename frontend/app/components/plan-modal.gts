import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import { htmlSafe } from '@ember/template';
import type { SafeString } from '@ember/template';
import { marked } from 'marked';
import TerminalIcon from './terminal-icon';
import { formatToolName, badgeClass, asString } from '../utils/ui-utils';
import type ApprovalQueueService from '../services/approval-queue';

export default class PlanModal extends Component {
  @service declare approvalQueue: ApprovalQueueService;

  @tracked isDeciding = false;

  get item() {
    return this.approvalQueue.planItem;
  }

  get isOpen() {
    return this.item !== null;
  }

  get badgeClass() {
    return `badge ${badgeClass(this.item?.tool_name)}`;
  }

  get toolLabel() {
    return formatToolName(this.item?.tool_name);
  }

  get title() {
    const plan = asString(this.item?.tool_input?.plan);
    const firstLine =
      plan.split('\n').find((l) => l.trim()) ?? this.item?.tool_name ?? 'Plan';
    return firstLine.replace(/^#+\s*/, '');
  }

  get bodyHtml(): SafeString {
    const plan = asString(this.item?.tool_input?.plan);
    // SAFETY: marked.parse returns string when called synchronously
    return htmlSafe(marked.parse(plan) as string);
  }

  get hasFocusTarget() {
    const ti = this.item?.terminal_info;
    return !!(
      ti?.iterm_session_id ||
      ti?.ghostty_resources_dir ||
      ti?.term_program
    );
  }

  approve = async () => {
    if (!this.item) return;
    this.isDeciding = true;
    try {
      await this.approvalQueue.decide(this.item.id, 'allow');
    } finally {
      this.isDeciding = false;
    }
  };

  deny = async () => {
    if (!this.item) return;
    this.isDeciding = true;
    try {
      await this.approvalQueue.decide(this.item.id, 'deny');
    } finally {
      this.isDeciding = false;
    }
  };

  focus = () => {
    if (!this.item) return;
    void fetch(`/focus/${this.item.id}`, { method: 'POST' });
  };

  close = () => {
    this.approvalQueue.closePlanModal();
  };

  backdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      this.approvalQueue.closePlanModal();
    }
  };

  <template>
    {{#if this.isOpen}}
      {{! template-lint-disable no-invalid-interactive }}
      <div
        id="plan-modal"
        class="open"
        role="dialog"
        {{on "click" this.backdropClick}}
      >
        {{! template-lint-enable no-invalid-interactive }}
        <div id="plan-modal-inner">
          <div id="plan-modal-header">
            <span class={{this.badgeClass}}>{{this.toolLabel}}</span>
            <span id="plan-modal-title">{{this.title}}</span>
          </div>
          <div id="plan-modal-body">{{this.bodyHtml}}</div>
          <div id="plan-modal-footer">
            <button
              type="button"
              class="btn-approve-plan"
              disabled={{this.isDeciding}}
              {{on "click" this.approve}}
            >
              Approve
            </button>
            <button
              type="button"
              class="btn-deny"
              disabled={{this.isDeciding}}
              {{on "click" this.deny}}
            >
              Deny
            </button>
            {{#if this.hasFocusTarget}}
              <button type="button" class="btn-focus" {{on "click" this.focus}}>
                <TerminalIcon @terminalInfo={{this.item.terminal_info}} />Focus
              </button>
            {{/if}}
            <button
              type="button"
              id="plan-modal-close"
              {{on "click" this.close}}
            >Close</button>
          </div>
        </div>
      </div>
    {{/if}}
  </template>
}
