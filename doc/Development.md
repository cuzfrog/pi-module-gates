# Development

## Project

This is a **pi extension** (`pi-module-gates`) that enforces module-boundary rules during coding agent sessions. When the agent edits or writes files, the extension checks whether the operation respects each module's contract — i.e., are you allowed to write to this file, and are you exposing the right public API?

## Setup

```bash
npm install
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run check` | Type-check all sources (tsc --noEmit) |
| `npm run test` | Run all unit tests (vitest) |

## Project Structure

```
src/
  index.ts                        — Extension entry point, wires gates to pi events
  types.ts                        — Public domain types (ModuleContract, ModuleIndex)
  context/
    system-prompt.ts              — Builds system prompt hint from module index
  gates/
    readonly-gate.ts              — Blocks writes to readonly files in a module
    sealed-gate.ts                — Blocks new exports on sealed files in a module
    signature-gate.ts             — Blocks changes to locked signatures
    export-gate.ts                — Blocks changes that break a module's public API
    export-checkers/
      index.ts                    — Auto-registers all export checkers
      registry.ts                 — ExportChecker registry: dispatch by language
      typescript.ts               — TS/JS-specific public-API checker
      rust.ts                     — Rust-specific public-API checker
      java.ts                     — Java-specific public-API checker
      go.ts                       — Go-specific public-API checker
      kotlin.ts                   — Kotlin-specific public-API checker
      scala.ts                    — Scala-specific public-API checker
    signature-checkers/
      index.ts                    — Auto-registers all signature checkers
      registry.ts                 — SignatureChecker registry: dispatch by language
      typescript.ts               — TS/JS-specific signature extractor
      rust.ts                     — Rust-specific signature stub
      java.ts                     — Java-specific signature stub
      go.ts                       — Go-specific signature stub
      kotlin.ts                   — Kotlin-specific signature stub
      scala.ts                    — Scala-specific signature stub
  graph/
    module-index-builder.ts       — Scans for module.md files, builds the index
    validation.ts                 — Validates that visible entries actually exist
test/
  index.test.ts
  context/system-prompt.test.ts
  gates/export-gate.test.ts
  gates/readonly-gate.test.ts
  gates/export-checkers/typescript.test.ts
  gates/export-checkers/rust.test.ts
  gates/signature-gate.test.ts
  gates/signature-checkers/typescript.test.ts
  graph/module-index-builder.test.ts
  graph/validation.test.ts
  fixture/
    module-simulation/            — Realistic project tree used by multiple tests
    malformed-module/             — Edge-case fixture
doc/
  AGENTS_GIT.md                   — Git conventions + gh bot setup
  Development.md                  — This file
```

## Adding a checker (new language)

### Export checker

1. Create `src/gates/export-checkers/<language>.ts` exporting an `ExportChecker` with `extensions` and `getNewExports`.
2. Add it to `src/gates/export-checkers/index.ts` with an import for its side-effect (auto-registers).
3. Create `src/gates/export-checkers/<language>.test.ts` with unit tests.
4. Add the file to the `sealed` list in `src/gates/export-checkers/MODULE.md`.

### Signature checker

1. Create `src/gates/signature-checkers/<language>.ts` exporting a `SignatureChecker` with `extensions` and `getSignatures(src)` returning a `Map<name, signatureText>`.
2. Add it to `src/gates/signature-checkers/index.ts` with an import for its side-effect.
3. Create `src/gates/signature-checkers/<language>.test.ts` with unit tests.
4. Add the file to the `sealed` list in `src/gates/signature-checkers/MODULE.md`.