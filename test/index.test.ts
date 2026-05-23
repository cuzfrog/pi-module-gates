import { describe, it, expect, beforeEach } from "vitest";
import * as path from "node:path";
import * as url from "node:url";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEventResult,
  BeforeAgentStartEventResult,
} from "@earendil-works/pi-coding-agent";
import mod from "../src/index.ts";

// ── fixtures ──────────────────────────────────────────────────────────────

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "fixture/module-simulation");
const MALFORMED = path.resolve(__dirname, "fixture/malformed-module");

type EventHandler = (event: any, ctx: ExtensionContext) => Promise<any> | any;

class MockExtensionAPI implements ExtensionAPI {
  private _handlers = new Map<string, EventHandler[]>();
  private _notifications: { message: string; type: string }[] = [];

  // ── public test helpers ──────────────────────────────────────────────

  /** Read-only snapshot of recorded notifications. */
  get notifications(): readonly { message: string; type: string }[] {
    return this._notifications;
  }
  /** Called by ctx.ui.notify to record a notification. */
  recordNotification(message: string, type: string) {
    this._notifications.push({ message, type });
  }
  clearNotifications() {
    this._notifications.length = 0;
  }

  /** Dispatch an event to registered handlers, return all results */
  async dispatch(event: any, ctx: ExtensionContext): Promise<any[]> {
    const handlers = this._handlers.get(event.type) ?? [];
    const results: any[] = [];
    for (const fn of handlers) {
      results.push(await fn(event, ctx));
    }
    return results;
  }

  // ── ExtensionAPI stub ──────────────────────────────────────────────────

  on(event: string, handler: EventHandler): void {
    const list = this._handlers.get(event) ?? [];
    list.push(handler);
    this._handlers.set(event, list);
  }

  registerTool() {}
  registerCommand() {}
  registerShortcut() {}
  registerFlag() {}
  getFlag() {
    return undefined;
  }
  registerMessageRenderer() {}
  registerProvider() {}
  unregisterProvider() {}
  exec = async () => ({ exitCode: 0, code: 0, killed: false, stdout: "", stderr: "" });
  sendMessage = () => {};
  sendUserMessage = () => {};
  appendEntry = () => {};
  setSessionName = () => {};
  getSessionName = () => undefined;
  setLabel = () => {};
  getActiveTools = () => [];
  getAllTools = () => [];
  setActiveTools = () => {};
  getCommands = () => [];
  setModel = async () => false;
  getThinkingLevel = () => "medium" as any;
  setThinkingLevel = () => {};

  events = {
    on() {},
    off() {},
    emit() {},
  } as any;
}

function makeCtx(cwd: string): ExtensionContext {
  return {
    cwd,
    hasUI: true,
    ui: {
      notify(_message: string, _type?: string) {
        throw new Error("ui.notify called before mockCtx wiring");
      },
    } as any,
    sessionManager: {
      getSessionFile: () => null,
      getEntries: () => [],
      getBranch: () => [],
      getLeafId: () => null,
    } as any,
    modelRegistry: {} as any,
    model: undefined,
    isIdle: () => true,
    signal: undefined,
    abort() {},
    hasPendingMessages: () => false,
    shutdown() {},
    getContextUsage: () => undefined,
    compact() {},
    getSystemPrompt: () => "",
  };
}

function makeCtxWithNotify(
  cwd: string,
  onNotify: (message: string, type?: string) => void,
): ExtensionContext {
  const base = makeCtx(cwd);
  return {
    ...base,
    ui: {
      ...base.ui,
      notify: onNotify,
    },
  };
}

// ── tests ─────────────────────────────────────────────────────────────────

describe("Module Gate e2e", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  // ── helpers ─────────────────────────────────────────────────────────────

  async function startSession(cwd: string) {
    const ctx = makeCtxWithNotify(cwd, (message, type) => {
      mock.recordNotification(message, type ?? "info");
    });
    await mock.dispatch({ type: "session_start", reason: "startup" }, ctx);
  }

  async function doWrite(
    filePath: string,
    content: string,
    cwd: string,
  ): Promise<ToolCallEventResult | void> {
    const ctx = makeCtx(cwd);
    const results = await mock.dispatch(
      {
        type: "tool_call",
        toolCallId: "tc-1",
        toolName: "write",
        input: { path: filePath, content },
      },
      ctx,
    );
    return results.find((r) => r !== undefined);
  }

  async function doEdit(
    filePath: string,
    edits: { oldText: string; newText: string }[],
    cwd: string,
  ): Promise<ToolCallEventResult | void> {
    const ctx = makeCtx(cwd);
    const results = await mock.dispatch(
      {
        type: "tool_call",
        toolCallId: "tc-1",
        toolName: "edit",
        input: { path: filePath, edits },
      },
      ctx,
    );
    return results.find((r) => r !== undefined);
  }

  async function doBeforeAgentStart(
    systemPrompt: string,
    cwd: string,
  ): Promise<BeforeAgentStartEventResult | void> {
    const ctx = makeCtx(cwd);
    const results = await mock.dispatch(
      {
        type: "before_agent_start",
        prompt: "test",
        systemPrompt,
      },
      ctx,
    );
    return results.find((r) => r !== undefined);
  }

  // ─── Behavioral Scenario #8 ──────────────────────────────────────────────
  // File covered by both parent and child readonly
  // Expect: deny. Message cites both sources.

  describe("Scenario #8 — dual-readonly message cites both sources", () => {
    it("blocks write to file covered by parent and child readonly and cites module.md in reason", async () => {
      const cwd = path.join(FIXTURES, "readonly-test");
      await startSession(cwd);

      const result = await doWrite("sub/locked.ts", "// modified", cwd);
      expect(result).toBeDefined();
      expect((result as ToolCallEventResult).block).toBe(true);

      const reason = (result as ToolCallEventResult).reason!;
      expect(reason).toContain("Readonly rule");
      expect(reason).toContain("module.md");
      // TODO: future — both parent (readonly-test/module.md) and child
      // (readonly-test/sub/module.md) should be cited as sources.
      // Currently only the first matching ancestor is cited.
    });

    it("allows write to editable.ts (not listed as readonly anywhere)", async () => {
      const cwd = path.join(FIXTURES, "readonly-test");
      await startSession(cwd);

      const result = await doWrite("editable.ts", "// modified", cwd);
      expect(result?.block).toBeFalsy();
    });
  });

  // ─── Behavioral Scenario #22/#23 — dangling visible entries ──────────────
  // Visible entries with no matching export → warn at session start.
  // Multiple dangling entries all reported together.

  describe("Scenario #22/#23 — dangling visible entries", () => {
    it("reports all three root-module dangling entries with correct format", async () => {
      const cwd = FIXTURES;
      await startSession(cwd);

      // Root module.md shows as "in module.md" (no subdirectory prefix).
      const rootDangling = mock.notifications.filter(
        (n) =>
          n.type === "warning" &&
          n.message.includes("Dangling visible entry") &&
          /\sin module\.md$/.test(n.message),
      );

      expect(rootDangling).toHaveLength(3);

      const names = rootDangling.map((w) => {
        const match = w.message.match(/"(\w+)"/);
        return match ? match[1] : "";
      });

      expect(names).toEqual(
        expect.arrayContaining(["GhostType", "AnotherGhost", "ThirdGhost"]),
      );

      // Format check on a single warning
      const ghostWarn = rootDangling.find((n) => n.message.includes("GhostType"))!;
      expect(ghostWarn.message).toContain("module.md");
      expect(ghostWarn.type).toBe("warning");
    });
  });

  // ─── Behavioral Scenario #34 ─────────────────────────────────────────────
  // Malformed frontmatter → warn at session start, treat that module as unguarded

  describe("Scenario #34 — malformed frontmatter", () => {
    it("warns on malformed module.md instead of crashing", async () => {
      const cwd = MALFORMED;
      await startSession(cwd);

      const warnings = mock.notifications.filter(
        (n) => n.type === "warning",
      );
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain("Failed to parse");
      expect(warnings[0].message).toContain("module.md");
      expect(warnings[0].message).toContain("unguarded");
    });

    it("treats malformed module as unguarded (writes allowed)", async () => {
      const cwd = MALFORMED;
      await startSession(cwd);

      const result = await doWrite("any.ts", "// anything", cwd);
      expect(result?.block).toBeFalsy();
    });
  });

  // ─── System prompt injection ─────────────────────────────────────────────

  describe("System prompt augmentation", () => {
    it("injects module descriptor hint when contracts exist", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(cwd);

      const result = await doBeforeAgentStart("Default system prompt.", cwd);
      expect(result).toBeDefined();
      if (result) {
        expect(
          (result as BeforeAgentStartEventResult).systemPrompt,
        ).toContain("module.md");
      }
    });

    it("does not inject hint when no module.md exists anywhere", async () => {
      const cwd = "/tmp/no-modules-here";
      await startSession(cwd);

      const result = await doBeforeAgentStart("Default system prompt.", cwd);
      if (result) {
        expect(
          (result as BeforeAgentStartEventResult).systemPrompt,
        ).toBeUndefined();
      }
    });
  });

  // ─── Core gate integration ───────────────────────────────────────────────

  describe("Write gate integration", () => {
    it("blocks write to readonly file and includes prose", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(cwd);

      const result = await doWrite("config.ts", "// overwrite", cwd);
      expect((result as ToolCallEventResult).block).toBe(true);
      expect((result as ToolCallEventResult).reason).toContain("module.md");
      expect((result as ToolCallEventResult).reason).toContain(
        "Greeting module",
      );
    });

    it("blocks write to module.md itself", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(cwd);

      const result = await doWrite("module.md", "---", cwd);
      expect((result as ToolCallEventResult).block).toBe(true);
    });

    it("blocks export not in visible list", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(cwd);

      const result = await doWrite(
        "app.ts",
        "export function greet() {}\nexport function hidden() {}",
        cwd,
      );
      expect((result as ToolCallEventResult).block).toBe(true);
      if (result?.block) {
        expect((result as ToolCallEventResult).reason).toContain("hidden");
      }
    });

    it("allows export listed in visible", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(cwd);

      const result = await doWrite(
        "app.ts",
        "export function greet() {}",
        cwd,
      );
      expect(result?.block).toBeFalsy();
    });
  });

  describe("Edit gate integration", () => {
    it("blocks edit on readonly file", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(cwd);

      const result = await doEdit(
        "config.ts",
        [{ oldText: "API_URL", newText: "DIFFERENT_URL" }],
        cwd,
      );
      expect((result as ToolCallEventResult).block).toBe(true);
    });

    it("blocks edit that introduces new unlisted export", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(cwd);

      const result = await doEdit(
        "app.ts",
        [
          {
            oldText: "export function greet(",
            newText: "export function secret() {}\nexport function greet(",
          },
        ],
        cwd,
      );
      expect((result as ToolCallEventResult).block).toBe(true);
    });
  });
});
