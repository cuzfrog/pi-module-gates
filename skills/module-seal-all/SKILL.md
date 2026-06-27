---
name: module-seal-all
description: Auto-seal all files in module descriptors so their module surface area cannot be increased.
disable-model-invocation: true
argument-hint: <user-instructions>
---

## What you do
- Find out module descriptor filename in the context.
- Find out source root in the context or from configurations.
- Derive scripts args from user instructions.
- Call the script to scans the source tree for module descriptors and auto-populates their `sealed` entries with code files in each module directory.

## Script Usage

```bash
node skills/module-seal-all/scripts/seal-all.mjs [options]
```

Options:
- `--root <dir>` - Source root directory (default: `src`)
- `--dry-run` - Show what would change without writing files
- `--create` - Create module descriptor files for directories without one (adds `sealed` only)
- `--descriptor-name <name>` - Module descriptor filename (default: `module.md`)

### Behavior

1. Finds all module descriptor files under the source root.
2. For each module directory, lists all direct files (not subdirectories, not module descriptor file itself)
3. Adds those files to the `sealed` frontmatter field
4. Preserves existing `sealed` entries, other fields in the frontmatter, and body prose

## Extra user instructions:
"$ARGUMENTS"