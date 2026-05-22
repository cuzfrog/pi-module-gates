You're describing a really elegant enforcement layer — moving from "the model is instructed to respect boundaries" (soft constraint) to "the boundary is mechanically enforced at the CLI level" (hard constraint). Let me think through this with you.Good, this gives a clear picture of Pi's extension system. Here's the full picture of what's available and how your `module.md` frontmatter idea maps onto it.

## Pi's Relevant Primitives

Pi has exactly the hooks you need. The key ones from its extension API:

- **`protected-paths.ts`** — blocks writes to specific paths via `on("tool_call")`
- **`permission-gate.ts`** — prompts for confirmation before running potentially dangerous commands, also via `on("tool_call")`
- **per-agent YAML frontmatter** — agent-specific permission policies expressed directly in markdown files with YAML frontmatter, using `allow` / `ask` / `deny` semantics

The `pi-permission-system` package is the most relevant thing for your use case. It provides four composing layers: path (cross-cutting) → external_directory (CWD boundary) → per-tool patterns → bash command patterns, with most-restrictive-wins semantics. A path `deny` cannot be overridden by a per-tool `allow`.

## How Your `module.md` Frontmatter Idea Fits

Your instinct is architecturally sound. The gap you've identified is that `module.md` is currently **instructional** (the model reads and may ignore it), and you want it to be **declarative** (a manifest that drives mechanical enforcement). The frontmatter becomes the contract:

```yaml
---
module: payments
visibility:
  public:
    - PaymentService
    - PaymentResult
  internal:
    - StripeAdapter
    - PaymentRepository
gates:
  readonly:
    - src/payments/types.ts       # public interface — never widen
    - src/payments/module.md      # self-referential guard
  deny_write:
    - src/payments/stripe/        # internal impl — no external agents
  ask_before_write:
    - src/payments/PaymentService.ts  # public surface — confirm expansions
---

## Payments Module
...prose rules...
```

A Pi extension would:
1. On `session_start` / `agent_start` — walk the repo tree, find all `module.md` files, parse their frontmatter
2. On `tool_call` (write/edit) — intercept any file path, resolve which module it belongs to, apply that module's gate rules
3. Optionally on `before_provider_request` — inject the relevant module's visibility contract into the system prompt for the files being touched

## The Two-Layer Enforcement Design

The elegant insight is that you get **two complementary enforcement layers** from this:

```
Soft layer:  module.md prose → injected into context → guides model intent
Hard layer:  module.md frontmatter → parsed by extension → blocks/gates tool calls
```

The soft layer handles the 90% case. The hard layer catches the violations that slip through — specifically the surface-widening problem you mentioned, where the model adds a new export to a public interface file it shouldn't be touching at all.

For the `readonly` files in particular, the gate can be a hard `deny` with an explicit error message like `"types.ts is the public interface contract for payments — surface changes require an architecture session, not a feature agent."` That message itself becomes part of the agent's context when the denial fires, which steers it to find an alternative path rather than just failing silently.

## What You'd Need to Build

Pi doesn't ship this exact `module.md`-aware extension out of the box, but the primitives are all there. The extension surface you'd use:

```typescript
// Sketch of the extension
export default (pi) => {
  const moduleContracts = new Map(); // path prefix → parsed frontmatter

  pi.on("session_start", async () => {
    // Walk repo, find module.md files, parse YAML frontmatter
    // Build: file path → gate rules index
  });

  pi.on("tool_call", async (call, { deny, ask, allow }) => {
    if (!isWriteTool(call.name)) return allow();
    const filePath = call.input?.path;
    const gate = resolveGate(moduleContracts, filePath);
    if (!gate) return allow();
    if (gate === "deny") return deny(`Blocked: ${filePath} is readonly per module contract`);
    if (gate === "ask") return ask(`${filePath} is a public surface — confirm expansion?`);
    return allow();
  });
};
```

The `on("before_provider_request")` hook is also valuable — you can inject the relevant module's visibility section into the system prompt dynamically based on which files are in the current diff/context, so the model always has the contract in view even if it didn't read the `module.md` directly.

## One Design Consideration

The `readonly` / `deny_write` semantics work well for protecting existing surface. But for the *surface-widening* problem specifically — where the model adds a new export rather than editing an existing one — you may also want a post-write hook that validates the AST diff (e.g. using `ts-morph` in a bash tool call) and checks whether new public symbols were introduced in files not designated as `extensible`. That's a slightly different gate: not "can you write to this file" but "does your write introduce new public symbols in a protected module."