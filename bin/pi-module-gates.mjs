#!/usr/bin/env bun
// Bin entrypoint: executed by `bun` (see package.json#bin) and dispatches to
// src/cli/*.ts modules. Lives in .mjs for npm-install shebang compatibility on
// platforms that resolve `bin` to a file path directly; `bun` will load this as
// JavaScript since it has no TypeScript-specific syntax.
import { resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function printUsage() {
  process.stderr.write(`Usage: pi-module-gates <command> [...args]

Commands:
  install-claude [--project-dir <dir>]    Install Claude Code PreToolUse hooks into <dir>/.claude/settings.json
  uninstall-claude [--project-dir <dir>]  Remove Claude Code PreToolUse hooks from <dir>/.claude/settings.json

Environment:
  CLAUDE_PROJECT_DIR    Default --project-dir when running inside Claude Code.

Examples:
  pi-module-gates install-claude
  pi-module-gates install-claude --project-dir /path/to/project
  pi-module-gates uninstall-claude
`);
}

function parseProjectDir(argv) {
  let projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project-dir" && i + 1 < argv.length) {
      projectDir = argv[++i];
    }
  }
  return isAbsolute(projectDir) ? projectDir : resolve(process.cwd(), projectDir);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    printUsage();
    process.exit(1);
  }
  if (cmd === "-h" || cmd === "--help") {
    printUsage();
    process.exit(0);
  }

  const projectDir = parseProjectDir(rest);

  if (cmd === "install-claude") {
    const mod = await import(resolve(PKG_ROOT, "src/cli/install-claude.ts"));
    const result = mod.installClaude({ projectDir });
    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (cmd === "uninstall-claude") {
    const mod = await import(resolve(PKG_ROOT, "src/cli/uninstall-claude.ts"));
    const result = mod.uninstallClaude({ projectDir });
    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      process.exit(1);
    }
    process.exit(0);
  }

  process.stderr.write(`Unknown command: ${cmd}\n`);
  printUsage();
  process.exit(2);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[pi-module-gates] Unexpected error: ${message}\n`);
  process.exit(1);
});
