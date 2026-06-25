import * as fs from "node:fs";
import * as path from "node:path";
import {
  readSettings,
  removePreToolUse,
  writeSettings,
  HOOK_MARKER,
} from "../claude/settings-writer.ts";

export type UninstallClaudeOptions = {
  projectDir: string;
};

export type UninstallClaudeResult =
  | { ok: true; removed: boolean; written: string }
  | { ok: false; reason: string };

export function uninstallClaude(opts: UninstallClaudeOptions): UninstallClaudeResult {
  const projectDir = path.resolve(opts.projectDir);
  const settingsPath = path.join(projectDir, ".claude", "settings.json");

  if (!fs.existsSync(settingsPath)) {
    process.stdout.write(`No .claude/settings.json found at ${settingsPath} — nothing to do.\n`);
    return { ok: true, removed: false, written: settingsPath };
  }

  const before = readSettings(projectDir);
  const beforeHadMarker = JSON.stringify(before).includes(HOOK_MARKER);
  const after = removePreToolUse(before);
  const afterHasMarker = JSON.stringify(after).includes(HOOK_MARKER);

  if (beforeHadMarker && !afterHasMarker) {
    writeSettings(projectDir, after);
    process.stdout.write(`Removed pi-module-gates hooks from ${settingsPath}.\n`);
    return { ok: true, removed: true, written: settingsPath };
  }

  process.stdout.write(`No pi-module-gates hooks found in ${settingsPath}.\n`);
  return { ok: true, removed: false, written: settingsPath };
}