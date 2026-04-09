import Component from '@glimmer/component';
import { service } from '@ember/service';
import { eq } from '../utils/helpers';
import QueueCard from './queue-card';
import AskUserQuestionCard from './ask-user-question-card';
import type ApprovalQueueService from '../services/approval-queue';
import AnimatedEach from 'ember-animated/components/animated-each';
import { fadeIn } from 'ember-animated/motions/opacity';
import type TransitionContext from 'ember-animated/-private/transition-context';
import scrollAnchor from '../modifiers/scroll-anchor';

// Only fade in new cards. Removed cards leave the DOM immediately (no
// fadeOut delay) and kept cards stay at their new layout positions (no
// move transform). This makes each queue change a single atomic layout
// event — one ResizeObserver firing — so the scroll-anchor modifier can
// apply one clean immediate correction with no animation to chase.
function* cardTransition({
  insertedSprites,
  duration,
}: TransitionContext): Generator {
  yield Promise.all(insertedSprites.map((s) => fadeIn(s, { duration })));
}

export default class ApprovalQueue extends Component {
  @service declare approvalQueue: ApprovalQueueService;

  cardTransition = cardTransition;

  get normalItems() {
    return this.approvalQueue.items.filter((i) => !i.snoozedToDesktop);
  }

  get snoozedItems() {
    return this.approvalQueue.items.filter((i) => i.snoozedToDesktop);
  }

  get hasNormalItems() {
    return this.normalItems.length > 0;
  }

  get hasSnoozedItems() {
    return this.snoozedItems.length > 0;
  }

  <template>
    <div class="column">
      <h1><span class="dot"></span>Approval Queue</h1>
      {{#if this.hasNormalItems}}
        <div id="queue" {{scrollAnchor}}>
          {{#AnimatedEach
            this.normalItems key="id" use=this.cardTransition duration=200
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

      {{#if this.hasSnoozedItems}}
        <div id="for-review">
          <h2 class="for-review-heading">For Review</h2>
          <div id="for-review-list">
            {{#AnimatedEach
              this.snoozedItems key="id" use=this.cardTransition duration=200
              as |item|
            }}
              {{#if (eq item.tool_name "AskUserQuestion")}}
                <AskUserQuestionCard @item={{item}} />
              {{else}}
                <QueueCard @item={{item}} />
              {{/if}}
            {{/AnimatedEach}}
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}
