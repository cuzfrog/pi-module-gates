# pi-module-gates

Experimental pi extension that enforces AI coding agents to respect code module boundaries.

## Problem

AI coding agents produce ad-hoc edits with no awareness of module boundaries — they freely modify internal files, leak implementation details into public APIs, and break architectural contracts. The codebase has structure; the agent has none.

### Approach

**Module contracts as guardrails.** Each directory can contain a `module.md` (case-insensitive, name configurable) that declares:

- `visible` — the set of exports allowed to be added or modified in that module
- `readonly` — files and directories the agent must not touch

The extension intercepts agent `write`/`edit` operations and enforces these contracts. Violations are blocked with a clear reason.

### How it works

1. **Indexing** — On session start, scans the project tree for `module.md` files and builds a module index.
2. **System prompt** — Injects a hint so the agent knows to respect `module.md` conventions.
3. **Gating** — On every write/edit, checks:
   - **Readonly gate** — is the target file locked?
   - **Export gate** — would the change introduce an export not in the `visible` list?

### Example `module.md`

```markdown
---
visible: [greet, formatName]
readonly: [index.ts]
---

Any prose you want the agent to read.
```

## License

MIT

## Author
Cause Chung (cuzfrog@gmail.com)
