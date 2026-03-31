import Service, { service } from '@ember/service';
import type ApprovalQueueService from './approval-queue';

type FaviconState = 'idle' | 'pending' | 'offline';

function buildShieldSvg(stroke: string, icon: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    `<path d="M16 2 L4 7 L4 15 C4 22.7 9.3 29.4 16 31 C22.7 29.4 28 22.7 28 15 L28 7 Z" fill="#1e2330" stroke="${stroke}" stroke-width="1.5"/>` +
    icon +
    '</svg>'
  );
}

const PENDING_DATA_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    buildShieldSvg(
      '#f59e0b',
      '<circle cx="16" cy="14" r="2" fill="#f59e0b"/>' +
        '<rect x="15" y="17" width="2" height="5" rx="1" fill="#f59e0b"/>'
    )
  );

const OFFLINE_DATA_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    buildShieldSvg(
      '#ef4444',
      '<line x1="11" y1="11" x2="21" y2="21" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>' +
        '<line x1="21" y1="11" x2="11" y2="21" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>'
    )
  );

const FAVICON_HREFS: Record<FaviconState, string> = {
  idle: '', // filled at runtime with original href
  pending: PENDING_DATA_URL,
  offline: OFFLINE_DATA_URL,
};

export default class FaviconService extends Service {
  @service declare approvalQueue: ApprovalQueueService;

  #currentState: FaviconState = 'idle';
  #linkEl?: HTMLLinkElement;
  #originalHref?: string;
  #started = false;

  start() {
    if (this.#started) return;
    this.#started = true;
    const el = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    this.#linkEl = el ?? undefined;
    this.#originalHref = el?.href;
  }

  update() {
    const next = this.#deriveState();
    if (next === this.#currentState) return;
    this.#currentState = next;
    if (!this.#linkEl) return;
    this.#linkEl.href =
      next === 'idle' ? (this.#originalHref ?? '') : FAVICON_HREFS[next];
  }

  #deriveState(): FaviconState {
    if (this.approvalQueue.isOffline) return 'offline';
    if (this.approvalQueue.items.some((i) => !i.snoozedToDesktop))
      return 'pending';
    return 'idle';
  }
}
