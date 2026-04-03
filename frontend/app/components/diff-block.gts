import Component from '@glimmer/component';
import * as Diff from 'diff';
import { asString } from '../utils/ui-utils';
import type { QueueItem } from '../utils/ui-types';

interface Sig {
  Args: { item: QueueItem };
}

interface DiffLine {
  text: string;
  cssClass: string;
}

export default class DiffBlock extends Component<Sig> {
  get filePath() {
    return asString(
      this.args.item.tool_input?.file_path ?? this.args.item.tool_input?.path
    );
  }

  get fileDir() {
    const fp = this.filePath;
    const idx = fp.lastIndexOf('/');
    return idx >= 0 ? fp.slice(0, idx + 1) : '';
  }

  get fileBase() {
    const fp = this.filePath;
    const idx = fp.lastIndexOf('/');
    return idx >= 0 ? fp.slice(idx + 1) : fp;
  }

  get lines(): DiffLine[] {
    const oldStr = asString(
      this.args.item.tool_input?.old_string ?? this.args.item._old_content
    );
    const newStr = asString(
      this.args.item.tool_input?.new_string ??
        this.args.item.tool_input?.content
    );
    const result: DiffLine[] = [];
    for (const part of Diff.diffLines(oldStr, newStr)) {
      const lines = part.value.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      for (const line of lines) {
        if (part.added) {
          result.push({ text: '+ ' + line, cssClass: 'diff-added' });
        } else if (part.removed) {
          result.push({ text: '- ' + line, cssClass: 'diff-removed' });
        } else {
          result.push({ text: '  ' + line, cssClass: 'diff-context' });
        }
      }
    }
    return result;
  }

  <template>
    {{#if this.filePath}}
      <div class="file-path">
        {{#if this.fileDir}}<span
            class="file-path-dir"
          >{{this.fileDir}}</span>{{/if}}
        <span class="file-path-base">{{this.fileBase}}</span>
      </div>
    {{/if}}
    <pre class="diff-block">{{#each this.lines as |line|}}<span
          class={{line.cssClass}}
        >{{line.text}}
        </span>{{/each}}</pre>
  </template>
}
