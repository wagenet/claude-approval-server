import Component from '@glimmer/component';
import { service } from '@ember/service';
import type Owner from '@ember/owner';
import { on } from '@ember/modifier';
import ApprovalQueue from '../components/approval-queue';
import IdleSessions from '../components/idle-sessions';
import PlanModal from '../components/plan-modal';
import SettingsModal from '../components/settings-modal';
import type ApprovalQueueService from '../services/approval-queue';
import type AppSettingsService from '../services/app-settings';

export default class ApplicationTemplate extends Component {
  @service declare approvalQueue: ApprovalQueueService;
  @service declare appSettings: AppSettingsService;

  constructor(owner: Owner, args: object) {
    super(owner, args);
    void this.approvalQueue.start();
  }

  get notifDenied() {
    return (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'denied'
    );
  }

  openSettings = () => {
    this.appSettings.open();
  };

  <template>
    {{#if this.notifDenied}}
      <div id="notif-banner" class="visible">
        Notifications are blocked for this page. Check your browser's
        notification settings for
        <code>localhost:4759</code>
        and set it to Allow, then reload.
      </div>
    {{/if}}

    <div id="top-bar">
      <button
        type="button"
        id="settings-btn"
        title="Settings"
        {{on "click" this.openSettings}}
      >⚙</button>
    </div>

    <div class="columns">
      <ApprovalQueue />
      <IdleSessions />
    </div>

    <PlanModal />
    <SettingsModal />

    {{outlet}}
  </template>
}
