---
name: log-investigation
description: >-
  Investigates the claude-approval-server /log endpoint to find UI formatting gaps.
  Use when the user asks to check, analyze, or audit the approval server log items
  for formatting issues, dropped fields, or rendering improvements. Fetches live log
  data, enumerates tool_input fields per tool type, cross-references with the
  CodeBlock component rendering logic, and reports fields the UI silently discards.
---

# Log Investigation

## Workflow

### 1. Fetch the live log

```bash
curl -s http://localhost:4759/log | jq '.'
```

If the server is not running, start it: `bun index.ts &`

### 2. Inventory fields per tool type

Group entries by `tool_name`. For each type, list every key present in `tool_input` across all entries.

### 3. Cross-reference with rendering logic

Read `frontend/app/components/code-block.gts` (`get display()` getter) and `frontend/app/components/queue-card.gts`. For each tool type, note exactly which `tool_input` fields are read vs. silently ignored.

Current rendering per tool type:

| Tool                             | Rendered fields                                                                                   | Known drops   |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | ------------- |
| `Bash`                           | `command`, `description` (italic label)                                                           | `timeout`     |
| `Edit`                           | `file_path`, `old_string`, `new_string` (diff)                                                    | `replace_all` |
| `Write`                          | `file_path`, `content`                                                                            | —             |
| `Read`                           | `file_path`, `offset`, `limit`                                                                    | `pages`       |
| `Glob`                           | `path` (label), `pattern`                                                                         | —             |
| `Grep`                           | `path` (label), `pattern`, `output_mode`, `-i`, `multiline`, `-C`/`-A`/`-B`, `type`, `head_limit` | `offset`      |
| `WebFetch`                       | `url`                                                                                             | `prompt`      |
| `WebSearch`                      | `query`                                                                                           | —             |
| MCP tools                        | `query` string if present, else full JSON                                                         | varies        |
| `ExitPlanMode` / `EnterPlanMode` | `plan` (markdown, opens modal)                                                                    | —             |
| fallback                         | full JSON via `parseEmbeddedJson`                                                                 | —             |

### 4. Report findings

For each tool type with dropped fields, note:

- Field name and type
- Whether it affects the approve/deny decision (higher priority) or is purely internal like `timeout` (lower priority)
- Suggested rendering: label above code block, second line in code block, or inline annotation
