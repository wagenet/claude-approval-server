import { module, test } from 'qunit';
import {
  badgeClass,
  parseMcpToolName,
  formatToolName,
  shortCwd,
  langFromPath,
  splitPipedCommand,
  splitCommand,
  parseHeredoc,
  parseInterpreterCall,
  langFromInterpreter,
  parseGitCommit,
} from 'frontend/utils/ui-utils';

module('parseMcpToolName', function () {
  test('standard MCP tool', function (assert) {
    assert.deepEqual(
      parseMcpToolName('MCP__UNBLOCKED__UNBLOCKED_CONTEXT_ENGINE'),
      {
        server: 'unblocked',
        tool: 'unblocked_context_engine',
      }
    );
  });

  test('lowercases server and tool', function (assert) {
    assert.deepEqual(parseMcpToolName('MCP__EMBER__SEARCH_EMBER_DOCS'), {
      server: 'ember',
      tool: 'search_ember_docs',
    });
  });

  test('lowercase hook payload format', function (assert) {
    assert.deepEqual(
      parseMcpToolName('mcp__unblocked__unblocked_context_engine'),
      {
        server: 'unblocked',
        tool: 'unblocked_context_engine',
      }
    );
  });

  test('lowercase ember tool', function (assert) {
    assert.deepEqual(parseMcpToolName('mcp__ember__search_ember_docs'), {
      server: 'ember',
      tool: 'search_ember_docs',
    });
  });

  test('returns null for non-MCP tool', function (assert) {
    assert.strictEqual(parseMcpToolName('Bash'), null);
  });

  test('returns null for incomplete prefix', function (assert) {
    assert.strictEqual(parseMcpToolName('MCP__ONLY_TWO'), null);
  });
});

module('formatToolName', function () {
  test('MCP tool strips redundant server prefix and replaces underscores', function (assert) {
    assert.strictEqual(
      formatToolName('MCP__UNBLOCKED__UNBLOCKED_CONTEXT_ENGINE'),
      'unblocked / context engine'
    );
  });

  test('lowercase hook payload format', function (assert) {
    assert.strictEqual(
      formatToolName('mcp__unblocked__unblocked_context_engine'),
      'unblocked / context engine'
    );
  });

  test('MCP tool without redundant prefix', function (assert) {
    assert.strictEqual(
      formatToolName('mcp__unblocked__data_retrieval'),
      'unblocked / data retrieval'
    );
  });

  test('ember MCP tool strips server prefix', function (assert) {
    assert.strictEqual(
      formatToolName('mcp__ember__search_ember_docs'),
      'ember / search ember docs'
    );
  });

  test('PascalCase tool split into words', function (assert) {
    assert.strictEqual(formatToolName('ExitPlanMode'), 'Exit Plan Mode');
  });

  test('single-word tool unchanged', function (assert) {
    assert.strictEqual(formatToolName('Bash'), 'Bash');
  });

  test('undefined returns unknown', function (assert) {
    assert.strictEqual(formatToolName(undefined), 'unknown');
  });
});

module('badgeClass', function () {
  test('Bash', function (assert) {
    assert.strictEqual(badgeClass('Bash'), 'badge-bash');
  });

  test('Write', function (assert) {
    assert.strictEqual(badgeClass('Write'), 'badge-write');
  });

  test('Edit', function (assert) {
    assert.strictEqual(badgeClass('Edit'), 'badge-edit');
  });

  test('ExitPlanMode', function (assert) {
    assert.strictEqual(badgeClass('ExitPlanMode'), 'badge-plan');
  });

  test('EnterPlanMode', function (assert) {
    assert.strictEqual(badgeClass('EnterPlanMode'), 'badge-plan');
  });

  test('MCP tool uppercase', function (assert) {
    assert.strictEqual(
      badgeClass('MCP__UNBLOCKED__UNBLOCKED_CONTEXT_ENGINE'),
      'badge-mcp'
    );
  });

  test('MCP tool lowercase', function (assert) {
    assert.strictEqual(
      badgeClass('mcp__unblocked__unblocked_context_engine'),
      'badge-mcp'
    );
  });

  test('unknown defaults', function (assert) {
    assert.strictEqual(badgeClass('Glob'), 'badge-default');
  });

  test('undefined defaults', function (assert) {
    assert.strictEqual(badgeClass(undefined), 'badge-default');
  });
});

module('shortCwd', function () {
  test('empty string', function (assert) {
    assert.strictEqual(shortCwd(''), '');
  });

  test('1 part', function (assert) {
    assert.strictEqual(shortCwd('/foo'), '/foo');
  });

  test('2 parts', function (assert) {
    assert.strictEqual(shortCwd('/foo/bar'), '/foo/bar');
  });

  test('3 parts truncates', function (assert) {
    assert.strictEqual(shortCwd('/a/b/c'), '…/b/c');
  });

  test('deep path', function (assert) {
    assert.strictEqual(shortCwd('/a/b/c/d/e'), '…/d/e');
  });
});

module('langFromPath', function () {
  test('ts', function (assert) {
    assert.strictEqual(langFromPath('foo.ts'), 'typescript');
  });

  test('tsx', function (assert) {
    assert.strictEqual(langFromPath('app.tsx'), 'typescript');
  });

  test('js', function (assert) {
    assert.strictEqual(langFromPath('foo.js'), 'javascript');
  });

  test('py', function (assert) {
    assert.strictEqual(langFromPath('script.py'), 'python');
  });

  test('sh', function (assert) {
    assert.strictEqual(langFromPath('run.sh'), 'bash');
  });

  test('yaml', function (assert) {
    assert.strictEqual(langFromPath('config.yaml'), 'yaml');
  });

  test('yml', function (assert) {
    assert.strictEqual(langFromPath('config.yml'), 'yaml');
  });

  test('unknown extension', function (assert) {
    assert.strictEqual(langFromPath('file.xyz'), 'plaintext');
  });

  test('no extension', function (assert) {
    assert.strictEqual(langFromPath('Makefile'), 'plaintext');
  });
});

module('splitPipedCommand', function () {
  test('three segments', function (assert) {
    assert.deepEqual(splitPipedCommand('cat file.txt | grep pattern | sort'), [
      'cat file.txt',
      'grep pattern',
      'sort',
    ]);
  });

  test('two segments', function (assert) {
    assert.deepEqual(splitPipedCommand('ls -la | head -20'), [
      'ls -la',
      'head -20',
    ]);
  });

  test('single command returns null', function (assert) {
    assert.strictEqual(splitPipedCommand('ls'), null);
  });

  test('|| operator not split', function (assert) {
    assert.strictEqual(splitPipedCommand('cmd1 || cmd2'), null);
  });

  test('pipe inside double quotes not split', function (assert) {
    assert.strictEqual(splitPipedCommand('echo "a|b"'), null);
  });

  test('pipe inside single quotes not split', function (assert) {
    assert.strictEqual(splitPipedCommand("echo 'a|b'"), null);
  });

  test('pipe inside $(...) not split', function (assert) {
    assert.strictEqual(splitPipedCommand('echo $(cat file | grep x)'), null);
  });

  test('top-level pipe after subshell is split', function (assert) {
    assert.deepEqual(splitPipedCommand('echo $(cat file) | grep x'), [
      'echo $(cat file)',
      'grep x',
    ]);
  });
});

module('splitCommand', function () {
  test('pipe only', function (assert) {
    assert.deepEqual(splitCommand('cat file | grep x'), {
      segments: ['cat file', 'grep x'],
      seps: ['|'],
    });
  });

  test('&& only', function (assert) {
    assert.deepEqual(splitCommand('cd /tmp && ls'), {
      segments: ['cd /tmp', 'ls'],
      seps: ['&&'],
    });
  });

  test('mixed && and pipe', function (assert) {
    assert.deepEqual(
      splitCommand('cd /path && git show origin/main | head -5'),
      {
        segments: ['cd /path', 'git show origin/main', 'head -5'],
        seps: ['&&', '|'],
      }
    );
  });

  test('single command returns null', function (assert) {
    assert.strictEqual(splitCommand('ls'), null);
  });

  test('|| not split', function (assert) {
    assert.strictEqual(splitCommand('cmd1 || cmd2'), null);
  });

  test('& alone not split', function (assert) {
    assert.strictEqual(splitCommand('sleep 10 & echo done'), null);
  });

  test('&& inside quotes not split', function (assert) {
    assert.strictEqual(splitCommand('echo "a && b"'), null);
  });

  test('&& inside subshell not split', function (assert) {
    assert.strictEqual(splitCommand('echo $(cd /tmp && ls)'), null);
  });

  test('top-level && after subshell is split', function (assert) {
    assert.deepEqual(splitCommand('echo $(cd /tmp) && ls'), {
      segments: ['echo $(cd /tmp)', 'ls'],
      seps: ['&&'],
    });
  });

  test('semicolon splits', function (assert) {
    assert.deepEqual(splitCommand('cd /tmp; ls; echo done'), {
      segments: ['cd /tmp', 'ls', 'echo done'],
      seps: [';', ';'],
    });
  });

  test(';; not split', function (assert) {
    assert.strictEqual(
      splitCommand('case $x in a) echo a;; b) echo b;; esac'),
      null
    );
  });

  test('; inside quotes not split', function (assert) {
    assert.strictEqual(splitCommand('echo "a; b"'), null);
  });
});

module('parseHeredoc', function () {
  test('python heredoc detects language', function (assert) {
    const cmd = "cat > /tmp/patch.py << 'EOF'\nprint('hello')\nEOF";
    const result = parseHeredoc(cmd);
    assert.ok(result);
    assert.strictEqual(result!.lang, 'python');
    assert.strictEqual(result!.header, "cat > /tmp/patch.py << 'EOF'");
    assert.strictEqual(result!.body, "print('hello')");
  });

  test('typescript heredoc detects language', function (assert) {
    const cmd = 'cat > /tmp/foo.ts << EOF\nconst x = 1;\nEOF';
    const result = parseHeredoc(cmd);
    assert.ok(result);
    assert.strictEqual(result!.lang, 'typescript');
  });

  test('unknown extension falls back to plaintext', function (assert) {
    const cmd = "cat > /tmp/foo.xyz << 'EOF'\nsome content\nEOF";
    const result = parseHeredoc(cmd);
    assert.ok(result);
    assert.strictEqual(result!.lang, 'plaintext');
  });

  test('plain bash command returns null', function (assert) {
    assert.strictEqual(parseHeredoc('ls -la'), null);
  });

  test('piped command returns null', function (assert) {
    assert.strictEqual(parseHeredoc('cat file | grep x'), null);
  });

  test('python3 interpreter heredoc detects python', function (assert) {
    const result = parseHeredoc("python3 << 'EOF'\nprint('hello')\nEOF");
    assert.ok(result);
    assert.strictEqual(result!.lang, 'python');
  });

  test('compound command with python3 detects python', function (assert) {
    const result = parseHeredoc(
      "cd /some/dir && python3 << 'EOF'\nprint('hello')\nEOF"
    );
    assert.ok(result);
    assert.strictEqual(result!.lang, 'python');
  });

  test('node interpreter heredoc detects javascript', function (assert) {
    const result = parseHeredoc('node << EOF\nconsole.log(1)\nEOF');
    assert.ok(result);
    assert.strictEqual(result!.lang, 'javascript');
  });

  test('heredoc with trailing command appends it to header', function (assert) {
    const cmd =
      "cat > /tmp/script.mjs << 'SCRIPT'\nimport fs from 'fs';\nfs.writeFileSync('/tmp/out', 'hi');\nSCRIPT\nnode /tmp/script.mjs";
    const result = parseHeredoc(cmd);
    assert.ok(result);
    assert.strictEqual(
      result!.header,
      "cat > /tmp/script.mjs << 'SCRIPT'\nnode /tmp/script.mjs"
    );
    assert.strictEqual(
      result!.body,
      "import fs from 'fs';\nfs.writeFileSync('/tmp/out', 'hi');"
    );
    assert.strictEqual(result!.lang, 'javascript');
  });

  test('heredoc with semicolon-prefixed terminator (bash continuation style)', function (assert) {
    const cmd =
      "cat > /tmp/test.mjs << 'SCRIPT'\nimport fs from 'node:fs' \\\n  ; fs.writeFileSync('/tmp/out.txt', 'hello') \\\n  ; SCRIPT\nnode /tmp/test.mjs";
    const result = parseHeredoc(cmd);
    assert.ok(result);
    assert.strictEqual(
      result!.header,
      "cat > /tmp/test.mjs << 'SCRIPT'\nnode /tmp/test.mjs"
    );
    assert.strictEqual(
      result!.body,
      "import fs from 'node:fs'\nfs.writeFileSync('/tmp/out.txt', 'hello')"
    );
    assert.strictEqual(result!.lang, 'javascript');
  });
});

module('parseInterpreterCall', function () {
  test('python3 -c single quotes', function (assert) {
    const result = parseInterpreterCall("python3 -c 'print(1)'");
    assert.ok(result);
    assert.strictEqual(result!.lang, 'python');
    assert.strictEqual(result!.header, 'python3 -c');
    assert.strictEqual(result!.body, 'print(1)');
  });

  test('python -c double quotes', function (assert) {
    const result = parseInterpreterCall(
      'python -c "import sys; print(sys.version)"'
    );
    assert.ok(result);
    assert.strictEqual(result!.lang, 'python');
    assert.strictEqual(result!.body, 'import sys; print(sys.version)');
  });

  test('node -c', function (assert) {
    const result = parseInterpreterCall("node -c 'console.log(1)'");
    assert.ok(result);
    assert.strictEqual(result!.lang, 'javascript');
  });

  test('ruby -c', function (assert) {
    const result = parseInterpreterCall("ruby -c 'puts 1'");
    assert.ok(result);
    assert.strictEqual(result!.lang, 'ruby');
  });

  test('flags before -c included in header', function (assert) {
    const result = parseInterpreterCall("python3 -u -c 'print(1)'");
    assert.ok(result);
    assert.strictEqual(result!.header, 'python3 -u -c');
    assert.strictEqual(result!.body, 'print(1)');
  });

  test('node -e', function (assert) {
    const result = parseInterpreterCall(`node -e "console.log(1)"`);
    assert.ok(result);
    assert.strictEqual(result!.lang, 'javascript');
    assert.strictEqual(result!.header, 'node -e');
    assert.strictEqual(result!.body, 'console.log(1)');
  });

  test('cd && node -e compound command', function (assert) {
    const result = parseInterpreterCall(
      `cd /path && node -e "console.log('hi')"`
    );
    assert.ok(result);
    assert.strictEqual(result!.header, 'cd /path && node -e');
    assert.strictEqual(result!.body, "console.log('hi')");
    assert.strictEqual(result!.lang, 'javascript');
  });

  test('multiline node -e with cd prefix', function (assert) {
    const result = parseInterpreterCall(
      `cd /path \\\n  && node -e "import('./x.js').then(m => {\n  console.log(m);\n})"`
    );
    assert.ok(result);
    assert.strictEqual(result!.lang, 'javascript');
    assert.strictEqual(
      result!.body,
      "import('./x.js').then(m => {\n  console.log(m);\n})"
    );
  });

  test('non-interpreter command returns null', function (assert) {
    assert.strictEqual(parseInterpreterCall('ls -la'), null);
  });

  test('script file without -c returns null', function (assert) {
    assert.strictEqual(parseInterpreterCall('python3 script.py'), null);
  });

  test('trailing shell redirection and pipe', function (assert) {
    const result = parseInterpreterCall(
      `python3 -c "import json\nprint(json.dumps({}))" 2>&1 | head -30`
    );
    assert.ok(result);
    assert.strictEqual(result!.lang, 'python');
    assert.strictEqual(result!.body, 'import json\nprint(json.dumps({}))');
  });
});

module('parseGitCommit', function () {
  const TYPICAL = `git add ui.html ui.ts \\\n  && git commit -m "$(cat <<'EOF'\nfix(ui): make filename prominent\n\nSplit the path into dir and base.\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\nEOF\n)"`;

  test('parses subject, body, and trailer', function (assert) {
    const result = parseGitCommit(TYPICAL);
    assert.ok(result);
    assert.strictEqual(result!.subject, 'fix(ui): make filename prominent');
    assert.strictEqual(result!.body, 'Split the path into dir and base.');
    assert.deepEqual(result!.trailers, [
      'Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>',
    ]);
  });

  test('simplifies preamble', function (assert) {
    const result = parseGitCommit(TYPICAL);
    assert.strictEqual(
      result!.preamble,
      'git add ui.html ui.ts \\\n  && git commit -m "…"'
    );
  });

  test('subject only (no body, no trailers)', function (assert) {
    const cmd = `git commit -m "$(cat <<'EOF'\nchore: bump version\nEOF\n)"`;
    const result = parseGitCommit(cmd);
    assert.ok(result);
    assert.strictEqual(result!.subject, 'chore: bump version');
    assert.strictEqual(result!.body, '');
    assert.deepEqual(result!.trailers, []);
  });

  test('regular heredoc (no git commit) returns null', function (assert) {
    assert.strictEqual(
      parseGitCommit("cat > file.txt <<'EOF'\nhello\nEOF\n"),
      null
    );
  });

  test('plain bash command returns null', function (assert) {
    assert.strictEqual(parseGitCommit('ls -la'), null);
  });

  test('git -C /path commit is detected and preamble simplified', function (assert) {
    const cmd =
      `git -C /Users/pwagenet/Development/claude-approval-server add .claude/skills/log-investigation.md && ` +
      `git -C /Users/pwagenet/Development/claude-approval-server commit -m "$(cat <<'EOF'\n` +
      `chore: add log-investigation skill\n` +
      `\n` +
      `Captures the workflow.\n` +
      `\n` +
      `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n` +
      `EOF\n` +
      `)"`;
    const result = parseGitCommit(cmd);
    assert.ok(result);
    assert.strictEqual(result!.subject, 'chore: add log-investigation skill');
    assert.strictEqual(result!.body, 'Captures the workflow.');
    assert.ok(result!.preamble.includes('commit -m "…"'));
  });

  test('body containing << heredoc syntax is still detected', function (assert) {
    const cmd =
      `git add ui-utils.ts ui-utils.test.ts ui.html \\\n` +
      `  && git commit -m "$(cat <<'EOF'\n` +
      `feat(ui): detect interpreter in heredoc for syntax highlighting\n` +
      `\n` +
      `When a heredoc header has no filename extension (e.g. \`python3 << 'EOF'\`\n` +
      `or \`cd /dir && node << EOF\`), fall back to matching the interpreter name\n` +
      `using \`langFromInterpreter\` instead of defaulting to plaintext.\n` +
      `\n` +
      `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n` +
      `EOF\n` +
      `)"`;
    const result = parseGitCommit(cmd);
    assert.ok(result);
    assert.strictEqual(
      result!.subject,
      'feat(ui): detect interpreter in heredoc for syntax highlighting'
    );
  });
});

module('langFromInterpreter', function () {
  test('python3', function (assert) {
    assert.strictEqual(langFromInterpreter('python3'), 'python');
  });

  test('python', function (assert) {
    assert.strictEqual(langFromInterpreter('python'), 'python');
  });

  test('node', function (assert) {
    assert.strictEqual(langFromInterpreter('node'), 'javascript');
  });

  test('ruby', function (assert) {
    assert.strictEqual(langFromInterpreter('ruby'), 'ruby');
  });

  test('perl', function (assert) {
    assert.strictEqual(langFromInterpreter('perl'), 'perl');
  });

  test('bash', function (assert) {
    assert.strictEqual(langFromInterpreter('bash'), 'bash');
  });

  test('sh', function (assert) {
    assert.strictEqual(langFromInterpreter('sh'), 'bash');
  });
});
