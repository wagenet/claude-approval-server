import Service, { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import type ApprovalQueueService from './approval-queue';

type FaviconState = 'idle' | 'pending' | 'offline';

const SHIELD_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<path d="M16 2 L4 7 L4 15 C4 22.7 9.3 29.4 16 31 C22.7 29.4 28 22.7 28 15 L28 7 Z" fill="#1e2330" stroke="STROKE" stroke-width="1.5"/>';
const SHIELD_CLOSE = '</svg>';

const ICON_IDLE =
  '<polyline points="10,16 14,20 22,12" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';

const ICON_PENDING =
  '<circle cx="16" cy="14" r="2" fill="#f59e0b"/>' +
  '<rect x="15" y="17" width="2" height="5" rx="1" fill="#f59e0b"/>';

const ICON_OFFLINE =
  '<line x1="11" y1="11" x2="21" y2="21" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>' +
  '<line x1="21" y1="11" x2="11" y2="21" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>';

const STROKE_MAP: Record<FaviconState, string> = {
  idle: '#38bdf8',
  pending: '#f59e0b',
  offline: '#ef4444',
};

const ICON_MAP: Record<FaviconState, string> = {
  idle: ICON_IDLE,
  pending: ICON_PENDING,
  offline: ICON_OFFLINE,
};

function buildSvg(state: FaviconState): string {
  const stroke = STROKE_MAP[state];
  const icon = ICON_MAP[state];
  return SHIELD_OPEN.replace('STROKE', stroke) + icon + SHIELD_CLOSE;
}

function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export default class FaviconService extends Service {
  @service declare approvalQueue: ApprovalQueueService;

  @tracked currentState: FaviconState = 'idle';
  #interval?: ReturnType<typeof setInterval>;
  #linkEl?: HTMLLinkElement;

  start() {
    const el = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    this.#linkEl = el ?? undefined;
    this.#update();
    this.#interval = setInterval(() => this.#update(), 1000);
  }

  #update() {
    const next = this.#deriveState();
    if (next === this.currentState) return;
    this.currentState = next;
    this.#applyFavicon(next);
  }

  #deriveState(): FaviconState {
    if (this.approvalQueue.isOffline) return 'offline';
    const nonSnoozed = this.approvalQueue.items.filter(
      (i) => !i.snoozedToDesktop
    );
    if (nonSnoozed.length > 0) return 'pending';
    return 'idle';
  }

  #applyFavicon(state: FaviconState) {
    if (!this.#linkEl) return;
    if (state === 'idle') {
      this.#linkEl.href = '/favicon.svg';
    } else {
      this.#linkEl.href = svgToDataUrl(buildSvg(state));
    }
  }

  willDestroy() {
    super.willDestroy();
    clearInterval(this.#interval);
  }
}
