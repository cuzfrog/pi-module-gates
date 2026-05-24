---
name: module-freeze-all
description: Auto-freeze all files in module descriptors. Scans module.md files in the source tree and populates the frozen field with every file in each module directory. Use when initializing module gates or after adding new source files to enforce module boundaries.
---

# Module Freeze All

Scans the source tree for `module.md` descriptors and auto-populates their `frozen` entries with all files in each module directory.

## Usage

```bash
node skills/module-freeze-all/scripts/freeze-all.mjs [options]
```

Options:
- `--root <dir>` - Source root directory (default: `src`)
- `--dry-run` - Show what would change without writing files
- `--create` - Create `module.md` for directories without one (adds `frozen` only)
- `--descriptor-name <name>` - Module descriptor filename (default: `module.md`)

## Behavior

1. Finds all `module.md` files under the source root
2. For each module directory, lists all direct files (not subdirectories, not `module.md` itself)
3. Adds those files to the `frozen` frontmatter field
4. Preserves existing `frozen` entries, `visible`, `readonly`, and body prose
5. Skips files that belong to nested sub-modules
