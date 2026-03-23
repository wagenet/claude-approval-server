import Service, { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import type { QueueItem, IdleSession } from '../utils/ui-types';
import type AppSettingsService from './app-settings';
import { shortCwd } from '../utils/ui-utils';

export default class ApprovalQueueService extends Service {
  @service declare appSettings: AppSettingsService;

  @tracked items: QueueItem[] = [];
  @tracked idleSessions: IdleSession[] = [];
  @tracked planItem: QueueItem | null = null;

  get autoDenyMs() {
    return this.appSettings.autoDenyMs;
  }

  readonly notifiedIds = new Set<string>();
  #interval?: ReturnType<typeof setInterval>;

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
      this.items = items;
    }

    if (sessionsRes.status === 'fulfilled') {
      const sessions = sessionsRes.value;
      for (const session of sessions) {
        if (!this.notifiedIds.has(session.sessionId)) {
          this.notifiedIds.add(session.sessionId);
          this.#notify('Claude session idle', shortCwd(session.cwd ?? ''));
        }
      }
      this.idleSessions = sessions;
    }
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

  async dismissIdle(sessionId: string) {
    await fetch(`/idle/${sessionId}`, { method: 'DELETE' });
    this.idleSessions = this.idleSessions.filter(
      (s) => s.sessionId !== sessionId
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
