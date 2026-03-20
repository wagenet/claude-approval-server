import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import type Owner from '@ember/owner';

interface Sig {
  Args: { enqueuedAt: number; durationMs: number };
}

export default class CountdownTimer extends Component<Sig> {
  @tracked private currentTime = Date.now();
  #interval: ReturnType<typeof setInterval>;

  constructor(owner: Owner, args: Sig['Args']) {
    super(owner, args);
    this.#interval = setInterval(() => {
      this.currentTime = Date.now();
    }, 1000);
  }

  get label() {
    const elapsed = this.currentTime - this.args.enqueuedAt;
    const left = Math.max(0, this.args.durationMs - elapsed);
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000)
      .toString()
      .padStart(2, '0');
    return `${m}:${s} remaining`;
  }

  willDestroy() {
    super.willDestroy();
    clearInterval(this.#interval);
  }

  <template>
    <span class="timer">{{this.label}}</span>
  </template>
}
