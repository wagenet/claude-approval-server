export function badgeClass(toolName: string | undefined): string {
  if (toolName === 'Bash')  return 'badge-bash'
  if (toolName === 'Write') return 'badge-write'
  if (toolName === 'Edit')  return 'badge-edit'
  if (toolName === 'ExitPlanMode' || toolName === 'EnterPlanMode') return 'badge-plan'
  return 'badge-default'
}

export function shortCwd(cwd: string): string {
  if (!cwd) return ''
  const parts = cwd.split('/').filter(Boolean)
  return parts.length <= 2 ? cwd : '…/' + parts.slice(-2).join('/')
}

export function langFromPath(path: string): string {
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

import type { TerminalInfo } from './ui-types'

export function getTerminalIcon(ti: TerminalInfo | undefined): string {
  if (!ti) return ''
  const term = (ti.term_program ?? '').toLowerCase()
  if (term === 'vscode') {
    return `<svg viewBox="0 0 128 128" width="14" height="14" style="flex-shrink:0" aria-hidden="true"><path fill="currentColor" d="M88.21 9.36 38.57 54.62 14.2 39.1c-3.67-2.71-8.84-2.71-12.51 0-3.67 2.71-3.67 7.1 0 9.81l27.96 20.73-27.96 20.73c-3.67 2.71-3.67 7.1 0 9.81 3.67 2.71 8.84 2.71 12.51 0l24.37-15.53L88.21 118.64c3.04 2.25 7.32 2.25 10.36 0l29.43-21.73V33.09L98.57 9.36c-3.04-2.25-7.32-2.25-10.36 0Z"/></svg>`
  }
  if (ti.iterm_session_id || term === 'iterm.app') {
    return `<svg viewBox="0 0 24 24" width="14" height="14" style="flex-shrink:0" aria-hidden="true"><path fill="currentColor" d="M24 5.359v13.282A5.36 5.36 0 0 1 18.641 24H5.359A5.36 5.36 0 0 1 0 18.641V5.359A5.36 5.36 0 0 1 5.359 0h13.282A5.36 5.36 0 0 1 24 5.359m-.932-.233A4.196 4.196 0 0 0 18.874.932H5.126A4.196 4.196 0 0 0 .932 5.126v13.748a4.196 4.196 0 0 0 4.194 4.194h13.748a4.196 4.196 0 0 0 4.194-4.194zm-.816.233v13.282a3.613 3.613 0 0 1-3.611 3.611H5.359a3.613 3.613 0 0 1-3.611-3.611V5.359a3.613 3.613 0 0 1 3.611-3.611h13.282a3.613 3.613 0 0 1 3.611 3.611M8.854 4.194v6.495h.962V4.194zM5.483 9.493v1.085h.597V9.48q.283-.037.508-.133.373-.165.575-.448.208-.284.208-.649a.9.9 0 0 0-.171-.568 1.4 1.4 0 0 0-.426-.388 3 3 0 0 0-.544-.261 32 32 0 0 0-.545-.209 1.8 1.8 0 0 1-.426-.216q-.164-.12-.164-.284 0-.223.179-.351.18-.126.485-.127.344 0 .575.105.239.105.5.298l.433-.5a2.3 2.3 0 0 0-.605-.433 1.6 1.6 0 0 0-.582-.159v-.968h-.597v.978a2 2 0 0 0-.477.127 1.2 1.2 0 0 0-.545.411q-.194.268-.194.634 0 .335.164.56.164.224.418.38a4 4 0 0 0 .552.262q.291.104.545.209.261.104.425.238a.39.39 0 0 1 .165.321q0 .225-.187.359-.18.134-.537.134-.381 0-.717-.134a4.4 4.4 0 0 1-.649-.351l-.388.589q.209.173.477.306.276.135.575.217.191.046.373.064"/></svg>`
  }
  if (ti.ghostty_resources_dir || term === 'ghostty') {
    return `<svg viewBox="0 0 24 24" width="14" height="14" style="flex-shrink:0" aria-hidden="true"><path fill="currentColor" d="M12 0C6.7 0 2.4 4.3 2.4 9.6v11.146c0 1.772 1.45 3.267 3.222 3.254a3.18 3.18 0 0 0 1.955-.686 1.96 1.96 0 0 1 2.444 0 3.18 3.18 0 0 0 1.976.686c.75 0 1.436-.257 1.98-.686.715-.563 1.71-.587 2.419-.018.59.476 1.355.743 2.182.699 1.705-.094 3.022-1.537 3.022-3.244V9.601C21.6 4.3 17.302 0 12 0M6.069 6.562a1 1 0 0 1 .46.131l3.578 2.065v.002a.974.974 0 0 1 0 1.687L6.53 12.512a.975.975 0 0 1-.976-1.687L7.67 9.602 5.553 8.38a.975.975 0 0 1 .515-1.818m7.438 2.063h4.7a.975.975 0 1 1 0 1.95h-4.7a.975.975 0 0 1 0-1.95"/></svg>`
  }
  return ''
}
