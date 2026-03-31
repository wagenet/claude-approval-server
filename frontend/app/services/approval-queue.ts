import Service, { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import type { QueueItem, IdleSession } from '../utils/ui-types';
import type AppSettingsService from './app-settings';
import type FaviconService from './favicon';
import { shortCwd, SESSION_COLORS } from '../utils/ui-utils';

export default class ApprovalQueueService extends Service {
  @service declare appSettings: AppSettingsService;
  @service declare favicon: FaviconService;

  @tracked items: QueueItem[] = [];
  @tracked idleSessions: IdleSession[] = [];
  @tracked planItem: QueueItem | null = null;
  @tracked isOffline = false;

  get autoDenyMs() {
    return this.appSettings.autoDenyMs;
  }

  readonly notifiedIds = new Set<string>();
  readonly #sessionColors = new Map<string, string>();
  #colorIndex = 0;
  #interval?: ReturnType<typeof setInterval>;
  #failCount = 0;

  sessionColor(sessionId: string): string {
    if (!this.#sessionColors.has(sessionId)) {
      this.#sessionColors.set(
        sessionId,
        SESSION_COLORS[this.#colorIndex % SESSION_COLORS.length]!
      );
      this.#colorIndex++;
    }
    return this.#sessionColors.get(sessionId)!;
  }

  async start() {
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
    await this.appSettings.load();
    void this.#poll();
    this.#interval = setInterval(() => {
      void this.#poll();
    }, 1000);
  }

  async #poll() {
    const [itemsRes, sessionsRes] = await Promise.allSettled([
      fetch('/queue').then((r) => r.json()) as Promise<QueueItem[]>,
      fetch('/idle').then((r) => r.json()) as Promise<IdleSession[]>,
    ]);

    const bothFailed =
      itemsRes.status === 'rejected' && sessionsRes.status === 'rejected';
    if (bothFailed) {
      this.#failCount++;
      if (this.#failCount >= 2) this.isOffline = true;
    } else {
      this.#failCount = 0;
      this.isOffline = false;
    }

    if (itemsRes.status === 'fulfilled') {
      const items = itemsRes.value;
      for (const item of items) {
        if (!this.notifiedIds.has(item.id)) {
          this.notifiedIds.add(item.id);
          this.#notify(
            `Approval: ${item.tool_name ?? 'unknown'}`,
            shortCwd(item.cwd ?? ''),
            {
              requireInteraction: this.appSettings.notifRequireInteraction,
            }
          );
        }
      }
      const sameState =
        this.items.length === items.length &&
        this.items.every(
          (item: QueueItem, i: number) =>
            item.id === items[i]?.id &&
            item.snoozedToDesktop === items[i]?.snoozedToDesktop
        );
      if (!sameState) {
        this.items = items;
      }
    }

    if (sessionsRes.status === 'fulfilled') {
      const sessions = sessionsRes.value;
      for (const session of sessions) {
        if (!this.notifiedIds.has(session.sessionId)) {
          this.notifiedIds.add(session.sessionId);
          this.#notify('Claude session idle', shortCwd(session.cwd ?? ''));
        }
      }
      const sameSessionIds =
        this.idleSessions.length === sessions.length &&
        this.idleSessions.every(
          (s: IdleSession, i: number) =>
            s.sessionId === sessions[i]?.sessionId &&
            s.snoozedToDesktop === sessions[i]?.snoozedToDesktop
        );
      if (!sameSessionIds) {
        this.idleSessions = sessions;
      }
    }

    this.favicon.update();
  }

  #notify(title: string, body: string, opts: NotificationOptions = {}) {
    if (
      !this.appSettings.notifEnabled ||
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    )
      return;
    const n = new Notification(title, { body, ...opts });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }

  async decide(id: string, decision: string) {
    await fetch(`/decide/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    this.items = this.items.filter((i) => i.id !== id);
    if (this.planItem?.id === id) {
      this.planItem = null;
    }
  }

  async dismissQueueItem(id: string) {
    await fetch(`/dismiss/${id}`, { method: 'POST' });
    this.items = this.items.filter((i) => i.id !== id);
  }

  async snooze(id: string) {
    await fetch(`/snooze/${id}`, { method: 'POST' });
    this.items = this.items.map((i) =>
      i.id === id ? { ...i, snoozedToDesktop: true } : i
    );
  }

  async dismissIdle(sessionId: string) {
    await fetch(`/idle/${sessionId}`, { method: 'DELETE' });
    this.idleSessions = this.idleSessions.filter(
      (s) => s.sessionId !== sessionId
    );
  }

  async snoozeIdle(sessionId: string) {
    await fetch(`/snooze-idle/${sessionId}`, { method: 'POST' });
    this.idleSessions = this.idleSessions.map((s) =>
      s.sessionId === sessionId ? { ...s, snoozedToDesktop: true } : s
    );
  }

  openPlanModal(item: QueueItem) {
    this.planItem = item;
  }

  closePlanModal() {
    this.planItem = null;
  }

  willDestroy() {
    super.willDestroy();
    clearInterval(this.#interval);
  }
}
