import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  readSettings,
  upsertPreToolUse,
  removePreToolUse,
  writeSettings,
  HOOK_MARKER,
} from "../../src/claude/settings-writer.ts";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pmg-settings-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("settings writer", () => {
  it("upsert on empty produces the marker entry", () => {
    const result = upsertPreToolUse({});
    const hooks = result.hooks?.PreToolUse ?? [];
    expect(hooks).toHaveLength(1);
    expect(hooks[0].matcher).toBe("Edit|MultiEdit|Write");
    expect(hooks[0].hooks[0].command).toContain(HOOK_MARKER);
    expect(hooks[0].hooks[0].command).toContain("${CLAUDE_PROJECT_DIR}");
  });

  it("is idempotent", () => {
    const a = upsertPreToolUse({});
    const b = upsertPreToolUse(a);
    expect((b.hooks?.PreToolUse ?? []).filter((m) => m.hooks.some((h) => h.command.includes(HOOK_MARKER)))).toHaveLength(1);
  });

  it("preserves unrelated top-level keys", () => {
    const a = upsertPreToolUse({ permissions: { allow: ["Bash"] }, model: "sonnet" });
    expect(a.permissions).toEqual({ allow: ["Bash"] });
    expect(a.model).toBe("sonnet");
  });

  it("preserves other hook events", () => {
    const a = upsertPreToolUse({
      hooks: {
        PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "echo done" }] }],
      },
    });
    expect(a.hooks?.PostToolUse).toHaveLength(1);
    expect(a.hooks?.PreToolUse).toHaveLength(1);
  });

  it("remove strips only marker entries", () => {
    const a = upsertPreToolUse({
      hooks: {
        PreToolUse: [
          { matcher: "*", hooks: [{ type: "command", command: "echo other" }] },
        ],
      },
    });
    const b = removePreToolUse(a);
    const pre = b.hooks?.PreToolUse ?? [];
    expect(pre).toHaveLength(1);
    expect(pre[0].hooks[0].command).toBe("echo other");
  });

  it("remove on marker-only yields empty settings", () => {
    const a = upsertPreToolUse({});
    const b = removePreToolUse(a);
    expect(b.hooks?.PreToolUse).toBeUndefined();
    expect(b.hooks).toBeUndefined();
  });

  it("writeSettings creates .claude dir and writes JSON", () => {
    const a = upsertPreToolUse({});
    const written = writeSettings(tmp, a);
    expect(written).toBe(path.join(tmp, ".claude", "settings.json"));
    const content = fs.readFileSync(written, "utf-8");
    expect(content).toContain(HOOK_MARKER);
    expect(content.endsWith("\n")).toBe(true);
  });

  it("readSettings returns {} on missing file", () => {
    expect(readSettings(tmp)).toEqual({});
  });
});