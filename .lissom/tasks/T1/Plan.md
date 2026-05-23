
## Implementation Plan

### Phase 1 — Module Index (`session_start`)

Walk the repo once on session start, build an in-memory index.

**Data structures:**

```typescript
type ModuleContract = {
  modulePath: string;        // absolute path e.g. /project/src/payments
  visible: string[] | null;  // null = no visible key, skip export check
                             // [] = explicit empty, block all exports
  readonly: string[];        // resolved globs/dirs/files
  prose: string;             // module.md body for injection on denial
};

type ModuleIndex = {
  contracts: ModuleContract[];       // ordered root → leaf
  fileToModule: Map<string, string>; // abs file path → module path
};
```

**Steps:**
- Glob `**/module.md` across repo
- Parse YAML frontmatter for each — `visible` (optional), `readonly` (optional)
- Resolve `readonly` entries relative to the module dir — support file, dir, and glob
- Map every file under each module dir to its owning module
- For nested modules, deepest `module.md` wins file ownership
- Implicitly add `module.md` itself to every module's `readonly` list
- On session start, validate `visible` entries against actual exported symbols — emit dangling entry warnings via `ctx.ui.notify`

---

### Phase 2 — System Prompt Hint (`before_agent_start`)

Single lightweight hint — no module content, just awareness:

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  if (index.contracts.length === 0) return;

  return {
    systemPrompt: event.systemPrompt + `

## Module descriptors
This project uses `module.md` files to declare visibility and readonly rules.
Before modifying files in any directory, check for a `module.md`.
If a `module.md` is present with a `visible` list, only exports in the list is allowed.
A `module.md` and its mentioned `readonly` files are readonly.
Violations will be blocked.`
  };
});
```

---

### Phase 3 — Write Gate (`tool_call`)

Intercepts all write and edit tool calls pre-execution. Two independent checks in sequence.

**3a — Readonly check:**

Resolve the file's owning module. Walk the full ancestor chain collecting all `readonly` patterns. If the file matches any pattern on the chain, deny immediately and inject the owning module's `module.md` prose.

Most restrictive source is reported in the denial message so the LLM knows which descriptor imposed the rule.

**3b — Export check:**

Only runs when:
- A language checker exists for this file extension
- At least one ancestor module has an explicit `visible` key (including `[]`)

Build the allowed set by intersecting `visible` lists from all ancestor modules that have an explicit `visible` key. Modules with no `visible` key are excluded from the intersection — they contribute no constraint.

Get the proposed file content from the tool call input. Retrieve prior content from disk (`fs.readFileSync`). Pass both to the language checker to get the list of newly introduced export names.

Any new export not in the allowed set is a violation. Deny, report all violations at once, inject the relevant `module.md` prose.

**Denial message format:**

```
[Module Gate] Write blocked — src/payments/stripe/adapter.ts

Readonly rule: file is listed as readonly in src/payments/module.md

  — or —

Export violations:
  • StripeInternal  not in visible list of src/payments/stripe/module.md
  • RawResponse     not in visible list of src/payments/module.md

Module contract (src/payments/stripe/module.md):
<full prose injected here>
```

---

### Phase 4 — Language Checkers

**Interface:**

```typescript
interface ExportChecker {
  extensions: string[];
  getNewExports(before: string, after: string): string[];
}

const checkerRegistry = new Map<string, ExportChecker>();

function registerChecker(checker: ExportChecker) {
  for (const ext of checker.extensions) {
    checkerRegistry.set(ext, checker);
  }
}

function getChecker(filePath: string): ExportChecker | null {
  return checkerRegistry.get(path.extname(filePath)) ?? null;
}
```

**TypeScript/JavaScript checker:**

Shallow regex scan — no full AST, covers the 90% case:

```typescript
const tsChecker: ExportChecker = {
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  getNewExports(before, after) {
    const extract = (src: string) =>
      [...src.matchAll(
        /^export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/gm
      )].map(m => m[1]);
    const beforeSet = new Set(extract(before));
    return extract(after).filter(name => !beforeSet.has(name));
  }
};
```

Known gap: `export { Foo }` re-export form not covered — deferred to later iteration.

**Rust checker:**

```typescript
const rustChecker: ExportChecker = {
  extensions: ['.rs'],
  getNewExports(before, after) {
    const extract = (src: string) =>
      [...src.matchAll(
        /^pub(?:\([^)]*\))?\s+(?:fn|struct|enum|trait|type|const|mod)\s+(\w+)/gm
      )].map(m => m[1]);
    const beforeSet = new Set(extract(before));
    return extract(after).filter(name => !beforeSet.has(name));
  }
};
```

Modifier (`pub(crate)`, `pub(super)` etc.) captured for display context but whitelist match is by name only.

---

### Phase 5 — Extension Structure

Global extension at `~/.pi/agent/extensions/module-gate/`:

```
module-gate/src
├── index.ts           # entry: wires session_start, before_agent_start, tool_call
├── graph/module-index-builder.ts   # repo walk, frontmatter parse, ModuleIndex construction
├── gates/
    ├── readonly-gate.ts            # readonly check logic
    ├── export-gate.ts              # export check logic
    └── checkers/
        ├── registry.ts        # ExportChecker interface + registry
        ├── typescript.ts
        └── rust.ts
├── context/system-prompt.ts            # before_agent_start injection

```
(Split files if above structure is not granular enough.)

---

### Decision register

| Decision | Choice |
|---|---|
| No `module.md` | Unguarded, no rules |
| `module.md` with no `visible` key | Only `readonly` applies, export check skipped |
| `module.md` with `visible: []` | All exports blocked |
| Multiple violations in one write | Deny, report all at once |
| Ancestor ceiling logic | Intersection of modules that have explicit `visible` key only |
| `module.md` readonly | Implicit, always |
| Dangling `visible` entries | Warn via `ctx.ui.notify` at session start |
| Unowned files | Unguarded, no warning |
| `readonly` scope | File, dir, glob — union across ancestor chain |
| First language checker | TypeScript/JavaScript |
| Second language checker | Rust |
| Import boundary enforcement | Deferred |

## Test
- Unit test should be implemented in `test/` mirroring the src structure.
- E2E test should be implemented in `test/e2e` using `pi -p` with reference to pi doc.
