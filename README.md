# pi-module-gates

Experimental pi extension that controls the entropy of the codebase by enforcing agents to respect code module boundaries.
I helps combat slop generation and code architecture degradation.

## Problem

AI coding agents produce ad-hoc edits with no awareness of module boundaries — they freely modify internal files, leak implementation details, and break architectural contracts. The codebase has structure; the agent has none.

__Constraints liberate, liberties constrain.__

### Approach

**Module contracts as guardrails.** Each directory can contain a descriptor file that declares:

- `visible` — the set of exports allowed to be added or modified in that module
- `readonly` — files and directories the agent must not touch

The extension intercepts agent `write`/`edit` operations and enforces these contracts. Violations are blocked with a clear reason.

### How it works

1. **Indexing** — On session start, scans the project tree for descriptor files and builds a module index.
2. **System prompt** — Injects a hint so the agent knows to respect descriptor file conventions.
3. **Gating** — On every write/edit, checks:
   - **Readonly gate** — is the target file locked?
   - **Export gate** — would the change introduce an export not in the `visible` list?

System prompt:
```markdown
## Module gates (boundary enforcement)
   This project uses `module.md` files to declare visibility and readonly rules that you should follow.
   If you cannot comply, reconsider your design, if impossible, raise to the user with tradeoffs.
   Each `module.md` gates its branching point in the tree.
   A `module.md` with a `visible` list means only entries in the list are allowed to be visible outside the module.
   A `module.md` and its mentioned `readonly` files are readonly.
   Violations will be blocked.
```
`module.md` filename is configurable.

## Module Descriptor Semantics

A module descriptor is a Markdown file (default name: `MODULE.md`) placed in a directory. You can piggy-back on your module context file for example `CONTEXT.md`.

### Simple readonly constraints

```markdown
---
visible: [greet, formatName]
readonly: [index.ts]
---

Any prose you want the agent to read.
```

## Configuration

Add a `module-gate` entry to `.pi/settings.json`:

```json
{
  "module-gate": {
    "moduleDescriptorFileName": "MODULE.md",
    "sourceRoot": "src/"
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `moduleDescriptorFileName` | `"module.md"` | File name used for module descriptors (case-insensitive) |
| `sourceRoot` | `"src/"` | Directory to scan for descriptor files and enforce gates. Set to `""` to scan from project root. |

When no settings file exists or no `module-gate` key is present, defaults apply.

## License

MIT

## Author
Cause Chung (cuzfrog@gmail.com)
