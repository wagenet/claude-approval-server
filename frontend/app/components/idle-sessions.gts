import Component from '@glimmer/component';
import { service } from '@ember/service';
import IdleSessionCard from './idle-session-card';
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

export default class IdleSessions extends Component {
  @service declare approvalQueue: ApprovalQueueService;

  cardTransition = cardTransition;

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
          {{#AnimatedEach
            this.sessions key="sessionId" use=this.cardTransition duration=200
            as |session|
          }}
            <IdleSessionCard @session={{session}} />
          {{/AnimatedEach}}
        </div>
      {{else}}
        <div id="idle-empty">No idle sessions</div>
      {{/if}}
    </div>
  </template>
}
