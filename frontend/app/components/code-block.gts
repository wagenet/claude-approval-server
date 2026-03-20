import Component from '@glimmer/component';
import hljs from 'highlight.js';
import { htmlSafe } from '@ember/template';
import type { SafeString } from '@ember/template';
import DiffBlock from './diff-block';
import {
  asString,
  langFromPath,
  parseMcpToolName,
  parseHeredoc,
  parseInterpreterCall,
  parseGitCommit,
  splitCommand,
  parseEmbeddedJson,
  type GitCommitInfo,
} from '../utils/ui-utils';
import type { QueueItem } from '../utils/ui-types';

interface Sig {
  Args: { item: QueueItem };
}

type DisplayKind =
  | { kind: 'diff' }
  | { kind: 'git-commit'; info: GitCommitInfo; preambleHtml: SafeString }
  | {
      kind: 'two-part';
      headerHtml: SafeString;
      bodyHtml: SafeString;
      bodyLang: string;
    }
  | {
      kind: 'code';
      lang: string;
      html: SafeString;
      filePath: string;
      fileDir: string;
      fileBase: string;
      description: string;
    };

function highlight(text: string, lang: string): SafeString {
  try {
    return htmlSafe(
      hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
    );
  } catch {
    // fallback: escape the text manually
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return htmlSafe(escaped);
  }
}

function fileParts(fp: string): { dir: string; base: string } {
  const idx = fp.lastIndexOf('/');
  return idx >= 0
    ? { dir: fp.slice(0, idx + 1), base: fp.slice(idx + 1) }
    : { dir: '', base: fp };
}

export default class CodeBlock extends Component<Sig> {
  get display(): DisplayKind {
    const { item } = this.args;

    if (item.tool_name === 'Edit') {
      return { kind: 'diff' };
    }

    if (item.tool_name === 'Bash') {
      const rawCmd = asString(item.tool_input?.command);
      const description = asString(item.tool_input?.description);

      const gitInfo = parseGitCommit(rawCmd);
      if (gitInfo) {
        return {
          kind: 'git-commit',
          info: gitInfo,
          preambleHtml: highlight(gitInfo.preamble, 'bash'),
        };
      }

      const heredoc = parseHeredoc(rawCmd);
      const interp = !heredoc ? parseInterpreterCall(rawCmd) : null;
      const embedded = heredoc ?? interp;
      if (embedded) {
        return {
          kind: 'two-part',
          headerHtml: highlight(embedded.header, 'bash'),
          bodyHtml: highlight(embedded.body, embedded.lang),
          bodyLang: embedded.lang,
        };
      }

      const split = splitCommand(rawCmd);
      const text = split
        ? split.segments
            .map((seg, i) => {
              if (i === 0) return seg;
              const sep = split.seps[i - 1];
              const indent = sep === '|' ? '      ' : '  ';
              return `${indent}${sep} ${seg}`;
            })
            .join(' \\\n')
        : rawCmd;

      return {
        kind: 'code',
        lang: 'bash',
        html: highlight(text, 'bash'),
        filePath: '',
        fileDir: '',
        fileBase: '',
        description,
      };
    }

    if (item.tool_name === 'Write') {
      const fp = asString(item.tool_input?.file_path ?? item.tool_input?.path);
      const lang = langFromPath(fp);
      const content = asString(item.tool_input?.content);
      const { dir, base } = fileParts(fp);
      return {
        kind: 'code',
        lang,
        html: highlight(content, lang),
        filePath: fp,
        fileDir: dir,
        fileBase: base,
        description: '',
      };
    }

    if (item.tool_name === 'Read') {
      const fp = asString(item.tool_input?.file_path);
      const { dir, base } = fileParts(fp);
      const offset = item.tool_input?.offset;
      const limit = item.tool_input?.limit;
      const parts: string[] = [];
      if (typeof offset === 'number') parts.push(`offset: ${offset}`);
      if (typeof limit === 'number') parts.push(`limit: ${limit}`);
      const text = parts.length > 0 ? parts.join('  ') : '(full file)';
      return {
        kind: 'code',
        lang: 'plaintext',
        html: highlight(text, 'plaintext'),
        filePath: fp,
        fileDir: dir,
        fileBase: base,
        description: '',
      };
    }

    if (item.tool_name === 'Glob') {
      const fp = asString(item.tool_input?.path);
      const { dir, base } = fileParts(fp);
      const pattern = asString(item.tool_input?.pattern);
      return {
        kind: 'code',
        lang: 'plaintext',
        html: highlight(pattern, 'plaintext'),
        filePath: fp,
        fileDir: dir,
        fileBase: base,
        description: '',
      };
    }

    if (item.tool_name === 'Grep') {
      const fp = asString(item.tool_input?.path ?? item.tool_input?.glob);
      const { dir, base } = fileParts(fp);
      const pattern = asString(item.tool_input?.pattern);
      const opts: string[] = [];
      const outputMode = item.tool_input?.output_mode;
      if (typeof outputMode === 'string' && outputMode !== 'files_with_matches')
        opts.push(`output: ${outputMode}`);
      if (item.tool_input?.['-i'] === true) opts.push('-i');
      if (item.tool_input?.multiline === true) opts.push('multiline');
      const ctx = item.tool_input?.context ?? item.tool_input?.['-C'];
      if (typeof ctx === 'number') {
        opts.push(`-C ${ctx}`);
      } else {
        const a = item.tool_input?.['-A'];
        const b = item.tool_input?.['-B'];
        if (typeof a === 'number') opts.push(`-A ${a}`);
        if (typeof b === 'number') opts.push(`-B ${b}`);
      }
      if (typeof item.tool_input?.type === 'string')
        opts.push(`type: ${item.tool_input.type}`);
      if (typeof item.tool_input?.head_limit === 'number')
        opts.push(`head: ${item.tool_input.head_limit}`);
      const text = opts.length > 0 ? `${pattern}\n${opts.join('  ')}` : pattern;
      return {
        kind: 'code',
        lang: 'plaintext',
        html: highlight(text, 'plaintext'),
        filePath: fp,
        fileDir: dir,
        fileBase: base,
        description: '',
      };
    }

    if (item.tool_name === 'WebFetch') {
      const url = asString(item.tool_input?.url);
      return {
        kind: 'code',
        lang: 'plaintext',
        html: highlight(url, 'plaintext'),
        filePath: '',
        fileDir: '',
        fileBase: '',
        description: '',
      };
    }

    if (item.tool_name === 'WebSearch') {
      const query = asString(item.tool_input?.query);
      return {
        kind: 'code',
        lang: 'plaintext',
        html: highlight(query, 'plaintext'),
        filePath: '',
        fileDir: '',
        fileBase: '',
        description: '',
      };
    }

    if (item.tool_name && parseMcpToolName(item.tool_name)) {
      const query = item.tool_input?.query;
      if (typeof query === 'string') {
        return {
          kind: 'code',
          lang: 'plaintext',
          html: highlight(query, 'plaintext'),
          filePath: '',
          fileDir: '',
          fileBase: '',
          description: '',
        };
      }
      const display = item.tool_input ? parseEmbeddedJson(item.tool_input) : {};
      const text = JSON.stringify(display, null, 2);
      return {
        kind: 'code',
        lang: 'json',
        html: highlight(text, 'json'),
        filePath: '',
        fileDir: '',
        fileBase: '',
        description: '',
      };
    }

    if (item.tool_name === 'ExitPlanMode') {
      const plan = asString(item.tool_input?.plan);
      return {
        kind: 'code',
        lang: 'markdown',
        html: highlight(plan, 'markdown'),
        filePath: '',
        fileDir: '',
        fileBase: '',
        description: '',
      };
    }

    const display = item.tool_input ? parseEmbeddedJson(item.tool_input) : {};
    const text = JSON.stringify(display, null, 2);
    return {
      kind: 'code',
      lang: 'json',
      html: highlight(text, 'json'),
      filePath: '',
      fileDir: '',
      fileBase: '',
      description: '',
    };
  }

  get isDiff() {
    return this.display.kind === 'diff';
  }

  get gitCommitDisplay() {
    const d = this.display;
    return d.kind === 'git-commit' ? d : null;
  }

  get twoPartDisplay() {
    const d = this.display;
    return d.kind === 'two-part' ? d : null;
  }

  get codeDisplay() {
    const d = this.display;
    return d.kind === 'code' ? d : null;
  }

  get commitSubjectParts() {
    const gc = this.gitCommitDisplay;
    if (!gc) return null;
    const { subject } = gc.info;
    const ccMatch = subject.match(/^(\w+)(\([^)]+\))?(!)?: /);
    if (ccMatch) {
      return {
        prefix: ccMatch[0],
        prefixType: ccMatch[1] ?? null,
        rest: subject.slice(ccMatch[0].length),
      };
    }
    return { prefix: null, prefixType: null, rest: subject };
  }

  <template>
    {{#if this.isDiff}}
      <DiffBlock @item={{@item}} />
    {{/if}}
    {{#let this.gitCommitDisplay as |gc|}}
      {{#if gc}}
        <div class="git-commit-block">
          <pre><code class="hljs language-bash">{{gc.preambleHtml}}</code></pre>
          <div class="commit-message">
            <div class="commit-subject">
              {{#if this.commitSubjectParts.prefix}}
                <span
                  class="commit-type commit-type-{{this.commitSubjectParts.prefixType}}"
                >{{this.commitSubjectParts.prefix}}</span>{{this.commitSubjectParts.rest}}
              {{else}}
                {{this.commitSubjectParts.rest}}
              {{/if}}
            </div>
            {{#if gc.info.body}}
              <div class="commit-body">{{gc.info.body}}</div>
            {{/if}}
            {{#each gc.info.trailers as |trailer|}}
              <div class="commit-trailer">{{trailer}}</div>
            {{/each}}
          </div>
        </div>
      {{/if}}
    {{/let}}
    {{#let this.twoPartDisplay as |tp|}}
      {{#if tp}}
        <div class="two-part-block">
          <pre><code class="hljs language-bash">{{tp.headerHtml}}</code></pre>
          <pre><code
              class="hljs language-{{tp.bodyLang}}"
            >{{tp.bodyHtml}}</code></pre>
        </div>
      {{/if}}
    {{/let}}
    {{#let this.codeDisplay as |cd|}}
      {{#if cd}}
        {{#if cd.description}}
          <div class="bash-description">{{cd.description}}</div>
        {{/if}}
        {{#if cd.filePath}}
          <div class="file-path">
            {{#if cd.fileDir}}<span
                class="file-path-dir"
              >{{cd.fileDir}}</span>{{/if}}
            <span class="file-path-base">{{cd.fileBase}}</span>
          </div>
        {{/if}}
        <pre><code class="hljs language-{{cd.lang}}">{{cd.html}}</code></pre>
      {{/if}}
    {{/let}}
  </template>
}
