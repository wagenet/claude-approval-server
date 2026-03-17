import hljs from 'highlight.js'
import * as Diff from 'diff'
import 'highlight.js/styles/github-dark.min.css'

interface StoppedSession {
  sessionId: string
  stoppedAt: number
  transcriptPath?: string
  terminal_info?: TerminalInfo
}

interface TerminalInfo {
  term_program?: string
  iterm_session_id?: string
  ghostty_resources_dir?: string
}

interface QueueItem {
  id: string
  enqueuedAt: number
  explanation?: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  session_id?: string
  cwd?: string
  terminal_info?: TerminalInfo
}

const POLL_MS = 1000
let AUTO_DENY_MS = 10 * 60 * 1000 // fallback until /config responds
const rendered = new Map<string, HTMLElement>()
const renderedStopped = new Map<string, HTMLElement>()

fetch('/config')
  .then(r => r.json())
  .then((cfg: { autoDenyMs: number }) => { AUTO_DENY_MS = cfg.autoDenyMs })
  .catch(() => {})

function badgeClass(toolName: string | undefined): string {
  if (toolName === 'Bash')  return 'badge-bash'
  if (toolName === 'Write') return 'badge-write'
  if (toolName === 'Edit')  return 'badge-edit'
  return 'badge-default'
}

function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    json: 'json', py: 'python',
    sh: 'bash', bash: 'bash',
    rb: 'ruby', go: 'go', rs: 'rust',
    html: 'html', css: 'css',
    md: 'markdown', yaml: 'yaml', yml: 'yaml',
    sql: 'sql',
  }
  return map[ext] ?? 'plaintext'
}

function makeDiffBlock(item: QueueItem): { pre: HTMLPreElement; filePath: string } {
  const filePath = (item.tool_input?.file_path ?? item.tool_input?.path ?? '') as string
  const oldStr = (item.tool_input?.old_string ?? '') as string
  const newStr = (item.tool_input?.new_string ?? '') as string
  const pre = document.createElement('pre')
  pre.className = 'diff-block'

  for (const part of Diff.diffLines(oldStr, newStr)) {
    const lines = part.value.split('\n')
    if (lines[lines.length - 1] === '') lines.pop()
    for (const line of lines) {
      const span = document.createElement('span')
      if (part.added) {
        span.className = 'diff-added'
        span.textContent = '+ ' + line
      } else if (part.removed) {
        span.className = 'diff-removed'
        span.textContent = '- ' + line
      } else {
        span.className = 'diff-context'
        span.textContent = '  ' + line
      }
      pre.appendChild(span)
      pre.appendChild(document.createTextNode('\n'))
    }
  }

  return { pre, filePath }
}

function makeCodeBlock(item: QueueItem): { pre: HTMLPreElement; filePath: string } {
  if (item.tool_name === 'Edit') return makeDiffBlock(item)

  const pre = document.createElement('pre')
  const code = document.createElement('code')
  let filePath = ''

  if (item.tool_name === 'Bash') {
    code.className = 'language-bash'
    code.textContent = (item.tool_input?.command ?? '') as string
  } else if (item.tool_name === 'Write') {
    filePath = (item.tool_input?.file_path ?? item.tool_input?.path ?? '') as string
    code.className = `language-${langFromPath(filePath)}`
    code.textContent = (item.tool_input?.content ?? '') as string
  } else {
    code.className = 'language-json'
    code.textContent = JSON.stringify(item.tool_input, null, 2)
  }

  pre.appendChild(code)
  hljs.highlightElement(code)
  return { pre, filePath }
}

function shortCwd(cwd: string): string {
  if (!cwd) return ''
  const parts = cwd.split('/').filter(Boolean)
  return parts.length <= 2 ? cwd : '…/' + parts.slice(-2).join('/')
}

function makeCard(item: QueueItem): HTMLElement {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.id = item.id

  const sessionId = item.session_id
    ? String(item.session_id).slice(0, 8) + '…'
    : '—'

  const elapsed = () => {
    const remaining = Math.max(0, Math.floor((AUTO_DENY_MS - (Date.now() - item.enqueuedAt)) / 1000))
    const m = Math.floor(remaining / 60)
    const sec = String(remaining % 60).padStart(2, '0')
    return `${m}:${sec} remaining`
  }

  const cwdShort = shortCwd(item.cwd ?? '')
  const cwdFull = item.cwd ?? ''
  const ti = item.terminal_info
  const hasFocusTarget = !!(ti?.iterm_session_id || ti?.ghostty_resources_dir || ti?.term_program)

  card.innerHTML = `
    <div class="card-header">
      <span class="badge ${badgeClass(item.tool_name)}">${item.tool_name ?? 'unknown'}</span>
      ${cwdShort ? `<span class="cwd" title="${cwdFull}">${cwdShort}</span>` : ''}
      <span class="timer" data-enqueued="${item.enqueuedAt}">${elapsed()}</span>
      <span class="session">${sessionId}</span>
    </div>
    <div class="code-block-wrapper"></div>
    <div class="explanation" style="display:none"></div>
    <div class="actions">
      <button class="btn-allow">Allow</button>
      <button class="btn-deny">Deny</button>
      <button class="btn-explain">Explain</button>
      <button class="btn-focus"${hasFocusTarget ? '' : ' style="display:none"'}>Focus</button>
    </div>
  `

  const wrapper = card.querySelector('.code-block-wrapper')!
  const { pre, filePath } = makeCodeBlock(item)
  if (filePath) {
    const label = document.createElement('div')
    label.className = 'file-path'
    label.textContent = filePath
    wrapper.appendChild(label)
  }
  wrapper.appendChild(pre)

  const allowBtn = card.querySelector<HTMLButtonElement>('.btn-allow')!
  const denyBtn = card.querySelector<HTMLButtonElement>('.btn-deny')!
  const explainBtn = card.querySelector<HTMLButtonElement>('.btn-explain')!
  const explanationEl = card.querySelector<HTMLElement>('.explanation')!

  if (item.explanation) {
    explanationEl.textContent = item.explanation
    explanationEl.style.display = ''
    explainBtn.style.display = 'none'
  }

  async function decide(decision: string) {
    allowBtn.disabled = true
    denyBtn.disabled = true
    try {
      await fetch(`/decide/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      card.remove()
      rendered.delete(item.id)
      updateIdle()
    } catch {
      allowBtn.disabled = false
      denyBtn.disabled = false
    }
  }

  allowBtn.addEventListener('click', () => decide('allow'))
  denyBtn.addEventListener('click', () => decide('deny'))

  explainBtn.addEventListener('click', async () => {
    explainBtn.disabled = true
    explainBtn.textContent = 'Explaining…'
    try {
      const res = await fetch(`/explain/${item.id}`)
      const body = await res.json() as { explanation?: string; error?: string }
      explanationEl.textContent = res.ok ? body.explanation! : `Error: ${body.error}`
      explanationEl.style.display = ''
      if (res.ok) { explainBtn.style.display = 'none'; return }
    } catch (e) {
      explanationEl.textContent = `Error: ${e}`
      explanationEl.style.display = ''
    }
    explainBtn.textContent = 'Explain'
    explainBtn.disabled = false
  })

  const focusBtn = card.querySelector<HTMLButtonElement>('.btn-focus')!
  focusBtn.addEventListener('click', async () => {
    await fetch(`/focus/${item.id}`, { method: 'POST' })
  })

  const timerEl = card.querySelector<HTMLElement>('.timer')!
  const interval = setInterval(() => {
    if (!card.isConnected) { clearInterval(interval); return }
    timerEl.textContent = elapsed()
  }, 1000)

  return card
}

function makeStoppedCard(session: StoppedSession): HTMLElement {
  const card = document.createElement('div')
  card.className = 'card'

  const sid = session.sessionId.slice(0, 8) + '…'
  const when = new Date(session.stoppedAt).toLocaleTimeString()
  const ti = session.terminal_info
  const hasFocusTarget = !!(ti?.iterm_session_id || ti?.ghostty_resources_dir || ti?.term_program)

  card.innerHTML = `
    <div class="card-header">
      <span class="badge badge-stopped">Finished</span>
      <span class="session">${sid}</span>
    </div>
    <div class="stopped-time">${when}</div>
    <div class="actions">
      <button class="btn-dismiss">Dismiss</button>
      <button class="btn-focus"${hasFocusTarget ? '' : ' style="display:none"'}>Focus</button>
    </div>
  `

  card.querySelector('.btn-dismiss')!.addEventListener('click', async () => {
    await fetch(`/stopped/${session.sessionId}`, { method: 'DELETE' })
    card.remove()
    renderedStopped.delete(session.sessionId)
    updateStoppedIdle()
  })

  card.querySelector<HTMLButtonElement>('.btn-focus')!.addEventListener('click', async () => {
    await fetch(`/focus-stopped/${session.sessionId}`, { method: 'POST' })
  })

  return card
}

function updateStoppedIdle() {
  const list = document.getElementById('stopped-list')!
  const idle = document.getElementById('stopped-idle')!
  const hasCards = list.children.length > 0
  idle.style.display = hasCards ? 'none' : ''
  list.style.display = hasCards ? 'flex' : 'none'
}

function updateIdle() {
  const q = document.getElementById('queue')!
  const idle = document.getElementById('idle')!
  const hasCards = q.children.length > 0
  idle.style.display = hasCards ? 'none' : ''
  q.style.display = hasCards ? 'flex' : 'none'
}

async function poll() {
  try {
    const items = await fetch('/queue').then(r => r.json()) as QueueItem[]
    const q = document.getElementById('queue')!
    const currentIds = new Set(items.map(i => i.id))

    for (const [id, card] of rendered) {
      if (!currentIds.has(id)) {
        card.remove()
        rendered.delete(id)
      }
    }

    for (const item of items) {
      if (!rendered.has(item.id)) {
        const card = makeCard(item)
        q.append(card)
        rendered.set(item.id, card)
      }
    }

    updateIdle()
  } catch {
    // server unreachable, ignore
  }
}

async function pollStopped() {
  try {
    const sessions = await fetch('/stopped').then(r => r.json()) as StoppedSession[]
    const list = document.getElementById('stopped-list')!
    const currentIds = new Set(sessions.map(s => s.sessionId))

    for (const [id, card] of renderedStopped) {
      if (!currentIds.has(id)) {
        card.remove()
        renderedStopped.delete(id)
      }
    }

    for (const session of sessions) {
      if (!renderedStopped.has(session.sessionId)) {
        const card = makeStoppedCard(session)
        list.append(card)
        renderedStopped.set(session.sessionId, card)
      }
    }

    updateStoppedIdle()
  } catch {
    // server unreachable, ignore
  }
}

poll()
setInterval(poll, POLL_MS)
pollStopped()
setInterval(pollStopped, POLL_MS)
