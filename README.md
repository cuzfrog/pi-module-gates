# pi-module-gates - Constraints liberate, liberties constrain.

Expirimental pi cli extension that controls the entropy of the codebase by enforcing code module boundaries.
It helps combat slop generation and code architecture degradation.

## Problem

AI coding agents produce edits with limited context knowledge (myopia) — their changes may leak implementation details, and break architectural contracts (slop).

### Approach

**Module contracts as guardrails.** Each directory can contain a descriptor file that declares:

- `readonly` — files and directories the agent must not touch
- `frozen` — files where no new exports are allowed
- `visible` — the set of exports allowed to be added or modified in that module

The extension intercepts agent `write`/`edit` operations and enforces these contracts. Violations are blocked with a clear reason.

The attempt to add 2 public helper functions is blocked, forcing the agent to re-think the design.
![Module Gate denial example](doc/module_gates_block.png)

### How it works

1. **Indexing** — On session start, scans the project tree for descriptor files and builds a module index.
2. **System prompt** — Injects a hint so the agent knows to respect descriptor file conventions.
3. **Gating** — On every write/edit, checks:
   - **Readonly gate** — is the target file locked?
     **Fronzen gate** — is there any surface change to the target file?
   - **Export gate** — would the change introduce an export not in the `visible` list?
   - **Module interface import gate** — external files can only import from the module not internal files, i.e. re-exports from `index.ts` or `mod.rs`. A child module may import from a parent module's internal files (not recommended but allowed). (Only Typescript/JavaScript and Rust are supported)
   - **Import gate** (not implemented yet) — would the change introduce an import violating visibility scope?

- System prompt: [system-prompt.md](src/context/system-prompt.template.md)
- Currently [supported languages](src/gates/checkers/index.ts): **TypeScript/JavaScript**, **Rust**, **Java**, **Go**, **Kotlin**, **Scala**

## Installation
```bash
pi install npm:@cuzfrog/pi-module-gates
```
Or load directly for a single session:
```bash
pi -e npm:@cuzfrog/pi-module-gates
```

## Module Descriptor Semantics

A module descriptor is a Markdown file (default name: `MODULE.md`) placed in a directory. You can piggy-back on your module context file for example `CONTEXT.md`.

### Readonly constraints

```markdown
---
readonly: [mod.rs]
---

Any prose for the agent to better understand the module.
```

### Frozen constraints

```yaml
frozen: [mod.rs]
```
Frozen files cannot change their surface size: no new exports or public entries are allowed.

A skill [module-freeze-all](src/skills/module-freeze-all) has been included to auto-freeze modules.

### Visibility whitelist (under redesign)

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

Add a `module-gates` entry to `.pi/settings.json`:

```json
{
  "module-gates": {
    "moduleDescriptorFileName": "MODULE.md",
    "moduleDescriptorReadonly": true,
    "sourceRoot": "src/"
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `moduleDescriptorFileName` | `MODULE.md` | File name used for module descriptors (case-insensitive) |
| `moduleDescriptorReadonly` | `true` | When `true`, descriptor files are readonly.|
| `sourceRoot` | `"src/"` | Directory to scan for descriptor files and enforce gates. Set to `""` to scan from project root. |
| `disableModuleInterfaceImportGate` | `false` | When `true`, imports will not be forced to be from module interface. |
| `disableSystemPrompt` | `false` | When `true`, skip injecting the module-gates hint into the agent's system prompt. |

When no settings file exists or no `module-gates` key is present, defaults apply.

## Claude Code Support

`pi-module-gates` runs as a Claude Code `PreToolUse` hook and enforces the same `MODULE.md` contracts on Claude's `Edit`, `MultiEdit`, and `Write` tool calls.

### Install

```bash
npx pi-module-gates install-claude
```

Writes `.claude/settings.json` in the current project, pointing the `PreToolUse` hook at the installed binary. Re-running is safe (idempotent). Use `--project-dir <dir>` to target another project.

The generated entry:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PROJECT_DIR}/node_modules/@cuzfrog/pi-module-gates/dist/claude/pre-tool-use.mjs",
            "statusMessage": "Module gate checking edit..."
          }
        ]
      }
    ]
  }
}
```

`${CLAUDE_PROJECT_DIR}` is a Claude Code placeholder; do not expand it in the file.

### Uninstall

```bash
npx pi-module-gates uninstall-claude
```

Removes only the hooks block this tool added. Other settings (`permissions.allow`, unrelated hook events, etc.) are preserved.

### Configuration

Claude Code uses the same `.pi/settings.json#module-gates` block as the pi extension. See the Configuration section above.

### Troubleshooting

- **Hook never fires.** Confirm `.claude/settings.json` contains a `PreToolUse` entry whose `command` contains `@cuzfrog/pi-module-gates`. Re-run `install-claude` to repair.
- **Hook fires but denies everything.** Check `.pi/settings.json#module-gates.sourceRoot`. The default is `src/`.
- **Internal error.** The hook fails open: it logs to stderr and exits 0. Inspect Claude's hook stderr output.
- **Bypass temporarily.** Remove the hook from `.claude/settings.json`, or run `uninstall-claude`.

## License

MIT

## Author
Cause Chung (cuzfrog@gmail.com)
