import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import IdleSessionCard from './idle-session-card';
import SessionHistoryModal from './session-history-modal';
import type ApprovalQueueService from '../services/approval-queue';
import type { IdleSession } from '../utils/ui-types';
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

export default class IdleSessions extends Component {
  @service declare approvalQueue: ApprovalQueueService;

  @tracked historyTarget: { sessionId: string; sessionName: string } | null =
    null;

  cardTransition = cardTransition;

  dismissAll = () => {
    void this.approvalQueue.dismissAllIdle();
  };

  openHistory = (session: IdleSession) => {
    this.historyTarget = {
      sessionId: session.sessionId,
      sessionName: session.sessionName ?? session.sessionId.slice(0, 8) + '…',
    };
  };

  closeHistory = () => {
    this.historyTarget = null;
  };

  get normalSessions() {
    return this.approvalQueue.idleSessions.filter((s) => !s.snoozedToDesktop);
  }

  get snoozedSessions() {
    return this.approvalQueue.idleSessions.filter((s) => s.snoozedToDesktop);
  }

  get hasNormalSessions() {
    return this.normalSessions.length > 0;
  }

  get hasSnoozedSessions() {
    return this.snoozedSessions.length > 0;
  }

  <template>
    <div class="column">
      <h1>
        <span class="dot dot-idle"></span>Idle Sessions
        {{#if this.hasNormalSessions}}
          <button
            type="button"
            class="btn-dismiss-all"
            {{on "click" this.dismissAll}}
          >Dismiss all</button>
        {{/if}}
      </h1>
      {{#if this.hasNormalSessions}}
        <div id="idle-list">
          {{#AnimatedEach
            this.normalSessions
            key="sessionId"
            use=this.cardTransition
            duration=200
            as |session|
          }}
            <IdleSessionCard
              @session={{session}}
              @onOpenHistory={{fn this.openHistory session}}
            />
          {{/AnimatedEach}}
        </div>
      {{else}}
        <div id="idle-empty">No idle sessions</div>
      {{/if}}

      {{#if this.hasSnoozedSessions}}
        <div id="for-review-idle">
          <h2 class="for-review-heading">For Review</h2>
          <div id="for-review-idle-list">
            {{#AnimatedEach
              this.snoozedSessions
              key="sessionId"
              use=this.cardTransition
              duration=200
              as |session|
            }}
              <IdleSessionCard
                @session={{session}}
                @onOpenHistory={{fn this.openHistory session}}
              />
            {{/AnimatedEach}}
          </div>
        </div>
      {{/if}}
    </div>

    {{#if this.historyTarget}}
      <SessionHistoryModal
        @sessionId={{this.historyTarget.sessionId}}
        @sessionName={{this.historyTarget.sessionName}}
        @onClose={{this.closeHistory}}
      />
    {{/if}}
  </template>
}
