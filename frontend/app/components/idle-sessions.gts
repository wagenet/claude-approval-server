import Component from '@glimmer/component';
import { service } from '@ember/service';
import IdleSessionCard from './idle-session-card';
import type ApprovalQueueService from '../services/approval-queue';

export default class IdleSessions extends Component {
  @service declare approvalQueue: ApprovalQueueService;

  get sessions() {
    return this.approvalQueue.idleSessions;
  }

  get hasSessions() {
    return this.sessions.length > 0;
  }

  <template>
    <div class="column">
      <h1><span class="dot dot-idle"></span>Idle Sessions</h1>
      {{#if this.hasSessions}}
        <div id="idle-list">
          {{#each this.sessions key="sessionId" as |session|}}
            <IdleSessionCard @session={{session}} />
          {{/each}}
        </div>
      {{else}}
        <div id="idle-empty">No idle sessions</div>
      {{/if}}
    </div>
  </template>
}
