import hljs from 'highlight.js'
import * as Diff from 'diff'
import { marked } from 'marked'
import 'highlight.js/styles/github-dark.min.css'
import type { StoppedSession, QueueItem, AskOption, AskQuestion } from './ui-types'
import { badgeClass, shortCwd, langFromPath, getTerminalIcon } from './ui-utils'

const POLL_MS = 1000
let AUTO_DENY_MS = 10 * 60 * 1000 // fallback until /config responds
const rendered = new Map<string, HTMLElement>()
const renderedStopped = new Map<string, HTMLElement>()

if (Notification.permission === 'default') Notification.requestPermission()

function notify(title: string, body: string) {
  if (Notification.permission !== 'granted') return
  const n = new Notification(title, { body })
  n.onclick = () => { window.focus(); n.close() }
}

fetch('/config')
  .then(r => r.json())
  .then((cfg: { autoDenyMs: number }) => { AUTO_DENY_MS = cfg.autoDenyMs })
  .catch(() => {})

// Plan modal logic
let planModalDecide: ((decision: string) => void) | null = null

function openPlanModal(item: QueueItem, decide: (decision: string) => void) {
  const modal = document.getElementById('plan-modal')!
  const title = document.getElementById('plan-modal-title')!
  const body = document.getElementById('plan-modal-body')!
  const approveBtn = document.getElementById('plan-modal-approve') as HTMLButtonElement
  const denyBtn = document.getElementById('plan-modal-deny') as HTMLButtonElement
  const focusBtn = document.getElementById('plan-modal-focus') as HTMLButtonElement
  const closeBtn = document.getElementById('plan-modal-close') as HTMLButtonElement

  const plan = (item.tool_input?.plan ?? '') as string
  const firstLine = plan.split('\n').find(l => l.trim()) ?? item.tool_name ?? 'Plan'
  title.textContent = firstLine.replace(/^#+\s*/, '')
  body.innerHTML = marked.parse(plan) as string

  approveBtn.disabled = false
  denyBtn.disabled = false

  planModalDecide = decide

  const ti = item.terminal_info
  const hasFocusTarget = !!(ti?.iterm_session_id || ti?.ghostty_resources_dir || ti?.term_program)
  focusBtn.style.display = hasFocusTarget ? '' : 'none'
  focusBtn.onclick = () => fetch(`/focus/${item.id}`, { method: 'POST' })
  focusBtn.innerHTML = getTerminalIcon(ti) + 'Focus'

  closeBtn.onclick = () => {
    modal.classList.remove('open')
    planModalDecide = null
  }

  modal.classList.add('open')

  approveBtn.onclick = async () => {
    approveBtn.disabled = true
    denyBtn.disabled = true
    modal.classList.remove('open')
    planModalDecide = null
    decide('allow')
  }

  denyBtn.onclick = async () => {
    approveBtn.disabled = true
    denyBtn.disabled = true
    modal.classList.remove('open')
    planModalDecide = null
    decide('deny')
  }
}

// Close modal on backdrop click (module scripts run after DOM is ready, no DOMContentLoaded needed)
document.getElementById('plan-modal')!.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    (e.currentTarget as HTMLElement).classList.remove('open')
    planModalDecide = null
  }
})

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

function parseEmbeddedJson(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try { result[key] = JSON.parse(trimmed); continue } catch {}
      }
    }
    result[key] = value
  }
  return result
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

  } else if (item.tool_name === 'Read') {
    filePath = (item.tool_input?.file_path ?? '') as string
    const offset = item.tool_input?.offset
    const limit = item.tool_input?.limit
    const parts: string[] = []
    if (offset != null) parts.push(`offset: ${offset}`)
    if (limit != null) parts.push(`limit: ${limit}`)
    code.className = 'language-plaintext'
    code.textContent = parts.length > 0 ? parts.join('  ') : '(full file)'

  } else if (item.tool_name === 'Glob') {
    filePath = (item.tool_input?.path ?? '') as string
    code.className = 'language-plaintext'
    code.textContent = (item.tool_input?.pattern ?? '') as string

  } else if (item.tool_name === 'Grep') {
    filePath = (item.tool_input?.path ?? item.tool_input?.glob ?? '') as string
    code.className = 'language-plaintext'
    code.textContent = (item.tool_input?.pattern ?? '') as string

  } else if (item.tool_name === 'WebFetch') {
    code.className = 'language-plaintext'
    code.textContent = (item.tool_input?.url ?? '') as string

  } else if (item.tool_name === 'WebSearch') {
    code.className = 'language-plaintext'
    code.textContent = (item.tool_input?.query ?? '') as string

  } else {
    const display = item.tool_input ? parseEmbeddedJson(item.tool_input) : {}
    code.className = 'language-json'
    code.textContent = JSON.stringify(display, null, 2)
  }

  pre.appendChild(code)
  hljs.highlightElement(code)
  return { pre, filePath }
}

function makeAskUserQuestionCard(item: QueueItem): HTMLElement {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.id = item.id

  const questions = ((item.tool_input as Record<string, unknown>)?.questions ?? []) as AskQuestion[]
  const sessionId = item.session_id ? String(item.session_id).slice(0, 8) + '…' : '—'

  const header = document.createElement('div')
  header.className = 'card-header'
  header.innerHTML = `<span class="badge badge-question">Question</span><span class="session">${sessionId}</span>`
  card.appendChild(header)

  const body = document.createElement('div')
  body.className = 'ask-body'
  card.appendChild(body)

  for (const q of questions) {
    const section = document.createElement('div')
    section.className = 'ask-section'

    const qHeader = document.createElement('div')
    qHeader.className = 'ask-section-header'
    qHeader.textContent = q.header

    const qText = document.createElement('div')
    qText.className = 'ask-section-question'
    qText.textContent = q.question

    section.appendChild(qHeader)
    section.appendChild(qText)

    for (const opt of q.options) {
      const row = document.createElement('div')
      row.className = 'ask-option'
      const labelEl = document.createElement('span')
      labelEl.className = 'ask-option-label'
      labelEl.textContent = opt.label
      row.appendChild(labelEl)
      if (opt.description) {
        const desc = document.createElement('span')
        desc.className = 'ask-option-desc'
        desc.textContent = opt.description
        row.appendChild(desc)
      }
      section.appendChild(row)
    }

    body.appendChild(section)
  }

  async function dismiss() {
    focusBtn.disabled = true
    dismissBtn.disabled = true
    try {
      await fetch(`/decide/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'allow' }),
      })
      card.remove()
      rendered.delete(item.id)
      updateIdle()
    } catch {
      focusBtn.disabled = false
      dismissBtn.disabled = false
    }
  }

  const actions = document.createElement('div')
  actions.className = 'actions'

  const focusBtn = document.createElement('button')
  focusBtn.className = 'btn-allow'
  focusBtn.innerHTML = getTerminalIcon(item.terminal_info) + 'Focus'
  focusBtn.addEventListener('click', () => fetch(`/focus/${item.id}`, { method: 'POST' }))

  const dismissBtn = document.createElement('button')
  dismissBtn.className = 'btn-deny'
  dismissBtn.textContent = 'Dismiss'
  dismissBtn.addEventListener('click', () => dismiss())

  actions.appendChild(focusBtn)
  actions.appendChild(dismissBtn)
  card.appendChild(actions)

  return card
}

function makeCard(item: QueueItem): HTMLElement {
  if (item.tool_name === 'AskUserQuestion') return makeAskUserQuestionCard(item)
  const card = document.createElement('div')
  const isPlan = item.tool_name === 'ExitPlanMode' || item.tool_name === 'EnterPlanMode'
  card.className = isPlan ? 'card card-plan' : 'card'
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
      <button class="btn-allow">${isPlan ? 'Review Plan…' : 'Allow'}</button>
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

  allowBtn.addEventListener('click', () => {
    if (isPlan) {
      openPlanModal(item, decide)
    } else {
      decide('allow')
    }
  })
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
  focusBtn.innerHTML = getTerminalIcon(ti) + 'Focus'
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
    <div class="stopped-output"></div>
    <div class="actions">
      <button class="btn-dismiss">Dismiss</button>
      <button class="btn-focus"${hasFocusTarget ? '' : ' style="display:none"'}>Focus</button>
    </div>
  `

  const outputEl = card.querySelector<HTMLElement>('.stopped-output')!
  fetch(`/stopped/${session.sessionId}/output`)
    .then(r => r.json())
    .then((body: { output?: string; error?: string }) => {
      if (body.output) {
        outputEl.textContent = body.output
        outputEl.style.display = ''
      }
    })
    .catch(() => {})

  card.querySelector('.btn-dismiss')!.addEventListener('click', async () => {
    await fetch(`/stopped/${session.sessionId}`, { method: 'DELETE' })
    card.remove()
    renderedStopped.delete(session.sessionId)
    updateStoppedIdle()
  })

  const stoppedFocusBtn = card.querySelector<HTMLButtonElement>('.btn-focus')!
  stoppedFocusBtn.innerHTML = getTerminalIcon(session.terminal_info) + 'Focus'
  stoppedFocusBtn.addEventListener('click', async () => {
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
        notify('Claude needs approval', item.tool_name ?? 'unknown')
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
        notify('Claude session finished', session.sessionId.slice(0, 8))
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
