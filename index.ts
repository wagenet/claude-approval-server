import { randomUUID } from 'crypto'
import index from './ui.html'

const PORT = 4759
const AUTO_DENY_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

interface PendingEntry {
  resolve: (decision: string) => void
  payload: Record<string, unknown>
  enqueuedAt: number
  explanation?: string
  explaining?: boolean
}

interface StoppedSession {
  sessionId: string
  stoppedAt: number
  transcriptPath?: string
  payload: Record<string, unknown>
}

const pending = new Map<string, PendingEntry>()
const stoppedSessions = new Map<string, StoppedSession>()

function logRemoval(id: string, reason: string, entry: PendingEntry) {
  const tool = entry.payload.tool_name as string ?? 'unknown'
  const input = JSON.stringify(entry.payload.tool_input ?? '').slice(0, 120)
  console.log(`[remove] ${reason} | ${tool} | ${input} | id=${id}`)
}

async function showNotification(id: string, toolName: string, summary: string) {
  const proc = Bun.spawn([
    'alerter',
    '--title', 'Claude needs approval',
    '--message', `${toolName}: ${summary.slice(0, 200)}`,
    '--actions', 'Allow,Deny',
    '--timeout', '0',
    '--group', id,
  ])
  const text = await new Response(proc.stdout).text()
  const trimmed = text.trim()
  if (trimmed !== 'Allow' && trimmed !== 'Deny') return
  const decision = trimmed === 'Allow' ? 'allow' : 'deny'
  const entry = pending.get(id)
  if (entry) { logRemoval(id, `alerter:${decision}`, entry); pending.delete(id); entry.resolve(decision) }
}

function buildExplainPrompt(payload: Record<string, unknown>): string {
  const toolName = payload.tool_name as string
  const input = (payload.tool_input ?? {}) as Record<string, unknown>

  if (toolName === 'Bash') {
    return `Briefly explain what this shell command does (2-3 sentences):\n\n\`\`\`bash\n${input.command}\n\`\`\``
  }
  if (toolName === 'Edit') {
    const path = input.file_path ?? input.path ?? 'unknown'
    return `Briefly explain what this code edit to ${path} does (2-3 sentences):\n\nRemoving:\n\`\`\`\n${input.old_string}\n\`\`\`\n\nAdding:\n\`\`\`\n${input.new_string}\n\`\`\``
  }
  if (toolName === 'Write') {
    const path = input.file_path ?? input.path ?? 'unknown'
    const content = String(input.content ?? '').slice(0, 3000)
    return `Briefly explain what writing this content to ${path} does (2-3 sentences):\n\n\`\`\`\n${content}\n\`\`\``
  }
  return `Briefly explain what this ${toolName} tool call does (2-3 sentences):\n\n${JSON.stringify(input, null, 2)}`
}

function allowResponse() {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'allow' },
    },
  }
}

function denyResponse(reason = 'Denied by user') {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'deny', message: reason },
    },
  }
}

interface TerminalInfo {
  term_program?: string
  iterm_session_id?: string
  ghostty_resources_dir?: string
}

function buildFocusScript(payload: Record<string, unknown>): string | null {
  const info = (payload.terminal_info ?? {}) as TerminalInfo
  const cwd = (payload.cwd ?? '') as string
  const termProgram = (info.term_program ?? '').toLowerCase()

  if (info.iterm_session_id) {
    const guid = info.iterm_session_id.split(':')[1]
    if (!guid) return null
    return `
tell application "iTerm2"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with s in sessions of t
        if unique ID of s is "${guid}" then
          select t
          tell s to select
        end if
      end repeat
    end repeat
  end repeat
  activate
end tell`
  }

  if (info.ghostty_resources_dir || termProgram === 'ghostty') {
    if (!cwd) return 'tell application "Ghostty" to activate'
    return `
tell application "Ghostty"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with trm in terminals of t
        if working directory of trm is "${cwd}" then
          set index of w to 1
          set selected of t to true
          activate
          return
        end if
      end repeat
    end repeat
  end repeat
  activate
end tell`
  }

  if (termProgram === 'vscode') {
    const parts = cwd.split('/')
    const workspace = parts[parts.length - 1] ?? ''
    if (!workspace) {
      return `
tell application "System Events"
  tell process "Code"
    set frontmost to true
  end tell
end tell`
    }
    return `
tell application "System Events"
  tell process "Code"
    set frontmost to true
    delay 0.3
    repeat with w in windows
      if name of w contains "${workspace}" then
        set index of w to 1
        exit repeat
      end if
    end repeat
  end tell
end tell`
  }

  return null
}

function focusTerminal(entry: PendingEntry) {
  const script = buildFocusScript(entry.payload)
  if (!script) return
  Bun.spawn(['osascript', '-e', script], { stdout: 'ignore', stderr: 'ignore' })
}

function stableStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val)
  if (Array.isArray(val)) return '[' + val.map(stableStringify).join(',') + ']'
  const obj = val as Record<string, unknown>
  return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

Bun.serve({
  port: PORT,
  idleTimeout: 0,
  routes: {
    '/': index,

    '/config': {
      GET() {
        return Response.json({ autoDenyMs: AUTO_DENY_TIMEOUT_MS })
      },
    },

    '/queue': {
      GET() {
        const items = [...pending.entries()].map(([id, { payload, enqueuedAt, explanation }]) => ({
          id,
          enqueuedAt,
          explanation,
          ...payload,
        }))
        return Response.json(items)
      },
    },

    '/decide/:id': {
      async POST(req) {
        const id = req.params.id
        const entry = pending.get(id)
        if (!entry) {
          return Response.json({ error: 'Not found or already decided' }, { status: 404 })
        }
        const body = (await req.json()) as { decision: string; message?: string }
        logRemoval(id, `web-ui:${body.decision}`, entry)
        pending.delete(id)
        Bun.spawn(['alerter', '--remove', id])
        entry.resolve(body.decision === 'allow' ? 'allow' : (body.message ?? body.decision))
        return Response.json({ ok: true })
      },
    },

    '/focus/:id': {
      POST(req) {
        const entry = pending.get(req.params.id)
        if (!entry) return Response.json({ error: 'Not found' }, { status: 404 })
        focusTerminal(entry)
        return Response.json({ ok: true })
      },
    },

    '/post-tool-use': {
      async POST(req) {
        const payload = (await req.json()) as Record<string, unknown>
        const sessionId = payload.session_id as string
        const toolName = payload.tool_name as string

        const toolInput = stableStringify(payload.tool_input)
        for (const [id, entry] of pending) {
          if (
            entry.payload.session_id === sessionId &&
            entry.payload.tool_name === toolName &&
            stableStringify(entry.payload.tool_input) === toolInput
          ) {
            logRemoval(id, 'post-tool-use', entry)
            pending.delete(id)
            Bun.spawn(['alerter', '--remove', id])
            entry.resolve('allow')
            break
          }
        }

        return Response.json({ ok: true })
      },
    },

    '/explain/:id': {
      async GET(req) {
        const entry = pending.get(req.params.id)
        if (!entry) return Response.json({ error: 'Not found' }, { status: 404 })
        if (entry.explaining) return Response.json({ error: 'Already in progress' }, { status: 409 })
        if (entry.explanation) return Response.json({ explanation: entry.explanation })

        entry.explaining = true
        try {
          const prompt = buildExplainPrompt(entry.payload)
          const proc = Bun.spawn(['claude', '-p', prompt, '--model', 'haiku'], { stdout: 'pipe', stderr: 'pipe' })
          const timeout = setTimeout(() => proc.kill(), 30_000)
          const [text, err] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
          ])
          clearTimeout(timeout)
          if (!text.trim() && err.trim()) {
            console.error('[explain]', err.trim())
            return Response.json({ error: err.trim() }, { status: 500 })
          }
          entry.explanation = text.trim()
          return Response.json({ explanation: entry.explanation })
        } catch (e) {
          console.error('[explain]', e)
          return Response.json({ error: String(e) }, { status: 500 })
        } finally {
          entry.explaining = false
        }
      },
    },

    '/health': {
      GET() {
        return Response.json({ ok: true, pending: pending.size, stopped: stoppedSessions.size })
      },
    },

    '/stop': {
      async POST(req) {
        const payload = (await req.json()) as Record<string, unknown>
        const sessionId = payload.session_id as string
        const transcriptPath = payload.transcript_path as string | undefined
        stoppedSessions.set(sessionId, { sessionId, stoppedAt: Date.now(), transcriptPath, payload })
        console.log(`[stop] session=${sessionId}`)
        Bun.spawn(['alerter', '--title', 'Claude session finished',
          '--message', sessionId.slice(0, 8), '--timeout', '5'])
        return Response.json({ ok: true })
      },
    },

    '/stopped': {
      GET() {
        const items = [...stoppedSessions.values()].map(({ sessionId, stoppedAt, transcriptPath, payload }) => ({
          sessionId, stoppedAt, transcriptPath,
          terminal_info: payload.terminal_info,
        }))
        return Response.json(items)
      },
    },

    '/stopped/:id': {
      DELETE(req) {
        const deleted = stoppedSessions.delete(req.params.id)
        return deleted
          ? Response.json({ ok: true })
          : Response.json({ error: 'Not found' }, { status: 404 })
      },
    },

    '/stopped/:id/output': {
      async GET(req) {
        const session = stoppedSessions.get(req.params.id)
        if (!session) return Response.json({ error: 'Not found' }, { status: 404 })
        if (!session.transcriptPath) return Response.json({ error: 'No transcript' }, { status: 404 })
        try {
          const text = await Bun.file(session.transcriptPath).text()
          const lines = text.trim().split('\n').filter(Boolean)
          let lastText: string | null = null
          for (const line of lines) {
            try {
              const entry = JSON.parse(line)
              const msg = entry.message
              if (msg?.role === 'assistant' && Array.isArray(msg.content)) {
                const texts = msg.content
                  .filter((b: { type: string }) => b.type === 'text')
                  .map((b: { text: string }) => b.text)
                  .join('')
                if (texts) lastText = texts
              }
            } catch { /* skip malformed lines */ }
          }
          if (!lastText) return Response.json({ error: 'No output found' }, { status: 404 })
          return Response.json({ output: lastText })
        } catch (e) {
          return Response.json({ error: String(e) }, { status: 500 })
        }
      },
    },

    '/focus-stopped/:id': {
      POST(req) {
        const session = stoppedSessions.get(req.params.id)
        if (!session) return Response.json({ error: 'Not found' }, { status: 404 })
        const script = buildFocusScript(session.payload)
        if (script) Bun.spawn(['osascript', '-e', script], { stdout: 'ignore', stderr: 'ignore' })
        return Response.json({ ok: true })
      },
    },

    '/pending': {
      async POST(req) {
        const payload = (await req.json()) as Record<string, unknown>

        const id = randomUUID()
        let resolveDecision!: (decision: string) => void
        const decisionPromise = new Promise<string>((resolve) => {
          resolveDecision = resolve
        })

        // Auto-resolve any lingering AskUserQuestion entries for this session
        const incomingSession = payload.session_id as string | undefined
        if (incomingSession) {
          for (const [pendingId, entry] of pending) {
            if (entry.payload.session_id === incomingSession && entry.payload.tool_name === 'AskUserQuestion') {
              logRemoval(pendingId, 'new-session-activity', entry)
              pending.delete(pendingId)
              Bun.spawn(['alerter', '--remove', pendingId])
              entry.resolve('allow')
            }
          }
        }

        pending.set(id, { resolve: resolveDecision, payload, enqueuedAt: Date.now() })
        const toolName = (payload.tool_name as string) ?? 'unknown'
        const summary = JSON.stringify(payload.tool_input ?? '')
        console.log(`[enqueue] ${toolName} | ${summary.slice(0, 120)} | id=${id}`)
        showNotification(id, toolName, summary)

        setTimeout(() => {
          const entry = pending.get(id)
          if (entry) {
            logRemoval(id, 'auto-deny-timeout', entry)
            pending.delete(id)
            resolveDecision('deny')
          }
        }, AUTO_DENY_TIMEOUT_MS)

        const encoder = new TextEncoder()
        let clientGone = false

        const stream = new ReadableStream({
          start(controller) {
            decisionPromise.then((decision) => {
              if (clientGone) return
              try {
                controller.enqueue(encoder.encode(JSON.stringify(
                  decision === 'allow' ? allowResponse() : denyResponse()
                )))
                controller.close()
              } catch {}
            })
          },
          cancel() {
            clientGone = true
            const entry = pending.get(id)
            if (entry) {
              logRemoval(id, 'stream-cancel', entry)
              pending.delete(id)
              Bun.spawn(['alerter', '--remove', id])
              resolveDecision('deny')
            }
          },
        })

        return new Response(stream, { headers: { 'Content-Type': 'application/json' } })
      },
    },
  },
})

console.log(`Approval server listening on http://localhost:${PORT}`)
