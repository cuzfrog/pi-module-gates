# pi-module-gates - Constraints liberate, liberties constrain.

pi cli extension that controls the entropy of the codebase by enforcing code module boundaries.
It helps combat slop generation and code architecture degradation.

## Installation

```bash
pi install npm:@cuzfrog/pi-module-gates
```

Or load directly for a single session:

```bash
pi -e npm:@cuzfrog/pi-module-gates
```

## Problem

AI coding agents produce edits with limited context knowledge (myopia) — their changes may leak implementation details, and break architectural contracts (slop).

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
   - **Import gate** (not implemented yet) — would the change introduce an import violating visibility scope?

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
readonly: [mod.rs]
---

Any prose for the agent to better understand the module.
```

### Visibility whitelist

```yaml
visible:
  - greet # equivalent to `path: ./greet`
  - sub/mod1/Foo
```
or:
```yaml
visible:
  - path: my_function
    modifier: pub(crate) # (optional) demands an exact match
```

| Scenario | Behavior |
|----------|----------|
| `visible` key absent or no `MODULE.md` | Module is unconstrained — exports are not gated. Equivalent to `null` internally. |
| `visible: []` | Module is fully closed — no new exports may be added. Editing existing exports is still allowed. |
| Malformed YAML frontmatter | The module is left unguarded and an info notification is emitted. |

### Export gating

```
project/
  MODULE.md          visible: [Foo, Bar]
  src/
    MODULE.md        visible: [Bar, Baz]
    app.ts           ← checked against `src/MODULE.md` only
```
A `MODULE.md` only enforces exports within its immediate directory.

### Import gating (not implemented yet)

```yaml
# parent/MODULE.md
visible:
  - sub/Tool # type Tool is allowed to be imported from parent

# parent/sub/MODULE.md (before complement pass)
visible:
  - Bar # type Bar is allowed to be imported from parent/sub within parent, but not outside parent
```
A `MODULE.md` semantically gates exposures at the module level it resides.

## Configuration

Add a `module-gate` entry to `.pi/settings.json`:

```json
{
  "module-gate": {
    "moduleDescriptorFileName": "MODULE.md",
    "moduleDescriptorReadonly": true,
    "sourceRoot": "src/"
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `moduleDescriptorFileName` | `"MODULE.md"` | File name used for module descriptors (case-insensitive) |
| `moduleDescriptorReadonly` | `true` | When `true`, descriptor files are readonly.|
| `sourceRoot` | `"src/"` | Directory to scan for descriptor files and enforce gates. Set to `""` to scan from project root. |

When no settings file exists or no `module-gate` key is present, defaults apply.

## License

MIT

## Author
Cause Chung (cuzfrog@gmail.com)
