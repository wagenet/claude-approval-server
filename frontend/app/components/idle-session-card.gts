import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import type Owner from '@ember/owner';
import { on } from '@ember/modifier';
import { htmlSafe } from '@ember/template';
import type { SafeString } from '@ember/template';
import { marked } from 'marked';
import TerminalIcon from './terminal-icon';
import { shortCwd } from '../utils/ui-utils';
import type { IdleSession } from '../utils/ui-types';
import type ApprovalQueueService from '../services/approval-queue';

interface Sig {
  Args: { session: IdleSession };
}

export default class IdleSessionCard extends Component<Sig> {
  @service declare approvalQueue: ApprovalQueueService;

  @tracked outputHtml: SafeString | string | null = null;
  @tracked isDismissing = false;

  constructor(owner: Owner, args: Sig['Args']) {
    super(owner, args);
    void this.loadOutput();
  }

  async loadOutput() {
    const { session } = this.args;
    if (!session.transcriptPath) {
      this.outputHtml = 'No transcript available';
      return;
    }
    try {
      const body = (await fetch(`/idle/${session.sessionId}/output`).then((r) =>
        r.json()
      )) as {
        output?: string;
        error?: string;
      };
      if (body.output) {
        // SAFETY: marked.parse returns string when called synchronously
        this.outputHtml = htmlSafe(marked.parse(body.output) as string);
      } else {
        this.outputHtml = 'No output available';
      }
    } catch {
      this.outputHtml = 'Failed to load output';
    }
  }

  get session() {
    return this.args.session;
  }

  get sessionLabel() {
    return this.session.sessionName ?? this.session.sessionId.slice(0, 8) + '…';
  }

  get when() {
    return new Date(this.session.idleSince).toLocaleTimeString();
  }

  get cwdShort() {
    return shortCwd(this.session.cwd ?? '');
  }

  get hasFocusTarget() {
    const ti = this.session.terminal_info;
    return !!(
      ti?.iterm_session_id ||
      ti?.ghostty_resources_dir ||
      ti?.term_program
    );
  }

  get isLoadingOutput() {
    return this.outputHtml === null;
  }

  dismiss = async () => {
    this.isDismissing = true;
    try {
      await this.approvalQueue.dismissIdle(this.session.sessionId);
    } finally {
      this.isDismissing = false;
    }
  };

  focus = () => {
    void fetch(`/focus-idle/${this.session.sessionId}`, { method: 'POST' });
  };

  <template>
    <div class="card">
      <div class="card-header">
        <span class="badge badge-idle">Idle</span>
        {{#if this.cwdShort}}
          <span class="cwd" title={{this.session.cwd}}>{{this.cwdShort}}</span>
        {{/if}}
        <span class="session">{{this.sessionLabel}}</span>
      </div>

      <div class="idle-time">{{this.when}}</div>

      <div class="idle-output">
        {{#if this.isLoadingOutput}}
          Loading…
        {{else}}
          {{this.outputHtml}}
        {{/if}}
      </div>

      <div class="actions">
        <button
          type="button"
          class="btn-dismiss"
          disabled={{this.isDismissing}}
          {{on "click" this.dismiss}}
        >
          Dismiss
        </button>
        {{#if this.hasFocusTarget}}
          <button type="button" class="btn-focus" {{on "click" this.focus}}>
            <TerminalIcon @terminalInfo={{this.session.terminal_info}} />Focus
          </button>
        {{/if}}
      </div>
    </div>
  </template>
}
