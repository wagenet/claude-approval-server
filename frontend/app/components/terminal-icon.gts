import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';
import type { SafeString } from '@ember/template';
import { getTerminalIcon } from '../utils/ui-utils';
import type { TerminalInfo } from '../utils/ui-types';

interface Sig {
  Args: { terminalInfo?: TerminalInfo };
}

export default class TerminalIcon extends Component<Sig> {
  get icon(): SafeString {
    return htmlSafe(getTerminalIcon(this.args.terminalInfo));
  }

  <template>{{this.icon}}</template>
}
