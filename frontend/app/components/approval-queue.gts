import Component from '@glimmer/component';
import { service } from '@ember/service';
import { eq } from '../utils/helpers';
import QueueCard from './queue-card';
import AskUserQuestionCard from './ask-user-question-card';
import type ApprovalQueueService from '../services/approval-queue';

export default class ApprovalQueue extends Component {
  @service declare approvalQueue: ApprovalQueueService;

  get items() {
    return this.approvalQueue.items;
  }

  get hasItems() {
    return this.items.length > 0;
  }

  <template>
    <div class="column">
      <h1><span class="dot"></span>Approval Queue</h1>
      {{#if this.hasItems}}
        <div id="queue">
          {{#each this.items key="id" as |item|}}
            {{#if (eq item.tool_name "AskUserQuestion")}}
              <AskUserQuestionCard @item={{item}} />
            {{else}}
              <QueueCard @item={{item}} />
            {{/if}}
          {{/each}}
        </div>
      {{else}}
        <div id="idle">No pending approvals</div>
      {{/if}}
    </div>
  </template>
}
