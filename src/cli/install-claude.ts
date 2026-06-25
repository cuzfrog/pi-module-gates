import * as fs from "node:fs";
import * as path from "node:path";
import {
  readSettings,
  upsertPreToolUse,
  writeSettings,
  HOOK_MARKER,
  PRE_TOOL_USE_MATCHER,
} from "../claude/settings-writer.ts";

export type InstallClaudeOptions = {
  projectDir: string;
};

export type InstallClaudeResult =
  | { ok: true; written: string }
  | { ok: false; reason: string };

export function installClaude(opts: InstallClaudeOptions): InstallClaudeResult {
  const projectDir = path.resolve(opts.projectDir);
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    return { ok: false, reason: `Project directory does not exist: ${projectDir}` };
  }

  const settingsPath = path.join(projectDir, ".pi", "settings.json");
  if (!fs.existsSync(settingsPath)) {
    process.stderr.write(
      `[Module Gate] No .pi/settings.json found at ${settingsPath} — using defaults.\n`,
    );
  }

  const settings = readSettings(projectDir);
  const updated = upsertPreToolUse(settings);
  const written = writeSettings(projectDir, updated);

  const relPath = path.relative(projectDir, written) || written;
  process.stdout.write(`Wrote ${relPath}\n\n`);
  process.stdout.write("Hook entry inserted under hooks.PreToolUse:\n");
  const matcher = updated.hooks?.PreToolUse?.find((m) =>
    m.hooks.some((h) => typeof h.command === "string" && h.command.includes(HOOK_MARKER)),
  );
  if (matcher) {
    process.stdout.write(`  matcher: "${matcher.matcher}"\n`);
    for (const h of matcher.hooks) {
      if (typeof h.command === "string") {
        process.stdout.write(`  command: ${h.command}\n`);
      }
      if (h.statusMessage) process.stdout.write(`  status:  ${h.statusMessage}\n`);
    }
  }
  process.stdout.write(`\nMatcher targets: ${PRE_TOOL_USE_MATCHER}\n`);

  return { ok: true, written };
}