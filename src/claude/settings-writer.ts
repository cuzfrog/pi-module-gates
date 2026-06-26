import * as fs from "node:fs";
import * as path from "node:path";

export const HOOK_MARKER = "@cuzfrog/pi-module-gates";
export const PRE_TOOL_USE_MATCHER = "Edit|MultiEdit|Write";

export type ClaudeHookCommand = {
  type: "command";
  command: string;
  statusMessage?: string;
};

export type ClaudeHook = ClaudeHookCommand | {
  type: string;
  command?: string;
  statusMessage?: string;
  [key: string]: unknown;
};

export type HookMatcher = {
  matcher: string;
  hooks: ClaudeHook[];
};

export type ClaudeSettings = {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
};

export function readSettings(projectDir: string): ClaudeSettings {
  const settingsPath = path.join(projectDir, ".claude", "settings.json");
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ClaudeSettings;
    }
    return {};
  } catch {
    return {};
  }
}

export function buildPreToolUseEntry(): HookMatcher {
  return {
    matcher: PRE_TOOL_USE_MATCHER,
    hooks: [
      {
        type: "command",
        command: `bun \${CLAUDE_PROJECT_DIR}/node_modules/@cuzfrog/pi-module-gates/src/claude/pre-tool-use.ts`,
        statusMessage: "Module gate checking edit...",
      },
    ],
  };
}

export function upsertPreToolUse(settings: ClaudeSettings): ClaudeSettings {
  const next: ClaudeSettings = JSON.parse(JSON.stringify(settings));
  next.hooks = next.hooks ?? {};
  const existing = next.hooks.PreToolUse ?? [];
  next.hooks.PreToolUse = existing.filter(
    (m) => !m.hooks.some((h) => typeof h.command === "string" && h.command.includes(HOOK_MARKER)),
  );
  next.hooks.PreToolUse.push(buildPreToolUseEntry());
  return next;
}

export function removePreToolUse(settings: ClaudeSettings): ClaudeSettings {
  const next: ClaudeSettings = JSON.parse(JSON.stringify(settings));
  if (!next.hooks?.PreToolUse) return next;
  const filtered = next.hooks.PreToolUse.filter(
    (m) => !m.hooks.some((h) => typeof h.command === "string" && h.command.includes(HOOK_MARKER)),
  );
  if (filtered.length === 0) {
    delete next.hooks.PreToolUse;
    if (Object.keys(next.hooks).length === 0) {
      delete next.hooks;
    }
  } else {
    next.hooks.PreToolUse = filtered;
  }
  return next;
}

export function writeSettings(projectDir: string, settings: ClaudeSettings): string {
  const claudeDir = path.join(projectDir, ".claude");
  fs.mkdirSync(claudeDir, { recursive: true });
  const target = path.join(claudeDir, "settings.json");
  fs.writeFileSync(target, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  return target;
}