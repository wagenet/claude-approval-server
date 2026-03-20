import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class AppSettingsService extends Service {
  @tracked theme: 'dark' | 'light' = 'dark';
  @tracked notifEnabled = true;
  @tracked notifRequireInteraction = true;
  @tracked autoDenyMs = 600000;
  @tracked isOpen = false;

  async load() {
    try {
      const cfg = (await fetch('/config').then((r) => r.json())) as {
        theme?: string;
        notifEnabled?: boolean;
        notifRequireInteraction?: boolean;
        autoDenyMs?: number;
      };
      this.theme = cfg.theme === 'light' ? 'light' : 'dark';
      this.notifEnabled = cfg.notifEnabled ?? true;
      this.notifRequireInteraction = cfg.notifRequireInteraction ?? true;
      this.autoDenyMs = cfg.autoDenyMs ?? 600000;
      document.documentElement.setAttribute('data-theme', this.theme);
    } catch {
      // ignore, use defaults
    }
  }

  async save(patch: {
    theme?: 'dark' | 'light';
    notifEnabled?: boolean;
    notifRequireInteraction?: boolean;
  }) {
    if (patch.theme) {
      this.theme = patch.theme;
      document.documentElement.setAttribute('data-theme', this.theme);
    }
    if (patch.notifEnabled !== undefined)
      this.notifEnabled = patch.notifEnabled;
    if (patch.notifRequireInteraction !== undefined)
      this.notifRequireInteraction = patch.notifRequireInteraction;
    try {
      const res = await fetch('/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        this.isOpen = false;
      }
    } catch {
      // network error, ignore
    }
  }

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }
}
