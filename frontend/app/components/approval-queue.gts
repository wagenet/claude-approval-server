import Component from '@glimmer/component';
import { service } from '@ember/service';
import { eq } from '../utils/helpers';
import QueueCard from './queue-card';
import AskUserQuestionCard from './ask-user-question-card';
import type ApprovalQueueService from '../services/approval-queue';
import AnimatedEach from 'ember-animated/components/animated-each';
import { fadeIn, fadeOut } from 'ember-animated/motions/opacity';
import move from 'ember-animated/motions/move';
import type TransitionContext from 'ember-animated/-private/transition-context';

function* cardTransition({
  insertedSprites,
  removedSprites,
  keptSprites,
  duration,
}: TransitionContext): Generator {
  yield Promise.all([
    ...removedSprites.map((s) => fadeOut(s, { duration })),
    ...keptSprites.map((s) => move(s)),
  ]);
  for (const sprite of insertedSprites) {
    void fadeIn(sprite, { duration });
  }
}

export default class ApprovalQueue extends Component {
  @service declare approvalQueue: ApprovalQueueService;

  cardTransition = cardTransition;

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
          {{#AnimatedEach
            this.items key="id" use=this.cardTransition duration=200
            as |item|
          }}
            {{#if (eq item.tool_name "AskUserQuestion")}}
              <AskUserQuestionCard @item={{item}} />
            {{else}}
              <QueueCard @item={{item}} />
            {{/if}}
          {{/AnimatedEach}}
        </div>
      {{else}}
        <div id="idle">No pending approvals</div>
      {{/if}}
    </div>
  </template>
}
