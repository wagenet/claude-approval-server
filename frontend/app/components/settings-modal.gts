import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import { eq } from '../utils/helpers';
import type AppSettingsService from '../services/app-settings';

export default class SettingsModal extends Component {
  @service declare appSettings: AppSettingsService;

  @tracked private _localTheme: 'dark' | 'light' | undefined;
  @tracked private _localNotifEnabled: boolean | undefined;
  @tracked private _localRequireInteraction: boolean | undefined;

  get isOpen() {
    return this.appSettings.isOpen;
  }

  get localTheme() {
    return this._localTheme ?? this.appSettings.theme;
  }

  get localNotifEnabled() {
    return this._localNotifEnabled ?? this.appSettings.notifEnabled;
  }

  get localRequireInteraction() {
    return (
      this._localRequireInteraction ?? this.appSettings.notifRequireInteraction
    );
  }

  close = () => {
    this._localTheme = undefined;
    this._localNotifEnabled = undefined;
    this._localRequireInteraction = undefined;
    this.appSettings.close();
  };

  backdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) this.appSettings.close();
  };

  setTheme = (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    this._localTheme = val === 'light' ? 'light' : 'dark';
  };

  setNotifEnabled = (e: Event) => {
    this._localNotifEnabled = (e.target as HTMLInputElement).checked;
  };

  setRequireInteraction = (e: Event) => {
    this._localRequireInteraction = (e.target as HTMLInputElement).checked;
  };

  save = async () => {
    await this.appSettings.save({
      theme: this.localTheme,
      notifEnabled: this.localNotifEnabled,
      notifRequireInteraction: this.localRequireInteraction,
    });
  };

  <template>
    {{#if this.isOpen}}
      {{! template-lint-disable no-invalid-interactive }}
      <div
        id="settings-modal"
        class="open"
        role="dialog"
        {{on "click" this.backdropClick}}
      >
        {{! template-lint-enable no-invalid-interactive }}
        <div id="settings-inner">
          <div id="settings-header">
            <span>Settings</span>
            <button
              type="button"
              id="settings-close"
              {{on "click" this.close}}
            >✕</button>
          </div>
          <div id="settings-body">
            <label>
              Theme
              <select {{on "change" this.setTheme}}>
                <option
                  value="dark"
                  selected={{eq this.localTheme "dark"}}
                >Dark</option>
                <option
                  value="light"
                  selected={{eq this.localTheme "light"}}
                >Light</option>
              </select>
            </label>
            <label class="settings-label-inline">
              <input
                type="checkbox"
                checked={{this.localNotifEnabled}}
                {{on "change" this.setNotifEnabled}}
              />
              Enable notifications
            </label>
            <label class="settings-label-inline">
              <input
                type="checkbox"
                checked={{this.localRequireInteraction}}
                {{on "change" this.setRequireInteraction}}
              />
              Require interaction (keep notifications visible)
            </label>
          </div>
          <div id="settings-footer">
            <button
              type="button"
              class="btn-deny"
              {{on "click" this.close}}
            >Cancel</button>
            <button
              type="button"
              class="btn-allow"
              {{on "click" this.save}}
            >Save</button>
          </div>
        </div>
      </div>
    {{/if}}
  </template>
}
