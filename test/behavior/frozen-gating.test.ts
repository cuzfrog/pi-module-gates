import { describe, it, expect, beforeEach, vi } from "vitest";
import * as path from "node:path";
import {
  MockExtensionAPI,
  FIXTURES,
  startSession,
  doWrite,
  doEdit,
} from "./helpers.ts";

vi.mock("../../src/config.ts", () => ({
  loadConfig: () => ({ moduleDescriptorFileName: "module.md", moduleDescriptorReadonly: "file", sourceRoot: "" }),
}));

import mod from "../../src/index.ts";

describe("frozen gating", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("blocks write that adds new export to frozen file", async () => {
    const cwd = path.join(FIXTURES, "frozen-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "frozen.ts",
      "export function existingFn() { return 1; }\nexport function newFn() { return 2; }",
      cwd,
    );
    expect(result).toBeDefined();
    expect((result as any).block).toBe(true);

    const reason = (result as any).reason!;
    expect(reason).toContain("Frozen rule");
    expect(reason).toContain("newFn");
    expect(reason).toContain("module.md");
  });

  it("allows write that modifies existing exports without adding new ones on frozen file", async () => {
    const cwd = path.join(FIXTURES, "frozen-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "frozen.ts",
      "export function existingFn() { return 2; }",
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });

  it("allows write to non-frozen file in same module", async () => {
    const cwd = path.join(FIXTURES, "frozen-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "editable.ts",
      "export const ROOT_SECRET = 'parent-only';\nexport function newFn() {}",
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });

  it("blocks edit that adds new export to frozen file", async () => {
    const cwd = path.join(FIXTURES, "frozen-test");
    await startSession(mock, cwd);

    const result = await doEdit(
      mock,
      "frozen.ts",
      [
        {
          oldText: "export function existingFn() { return 1; }",
          newText:
            "export function existingFn() { return 1; }\nexport function newFn() { return 2; }",
        },
      ],
      cwd,
    );
    expect(result).toBeDefined();
    expect((result as any).block).toBe(true);

    const reason = (result as any).reason!;
    expect(reason).toContain("Frozen rule");
    expect(reason).toContain("newFn");
  });

  it("blocks write that adds re-export to frozen file", async () => {
    const cwd = path.join(FIXTURES, "frozen-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "frozen.ts",
      'export function existingFn() { return 1; }\nexport { buildSystemPromptHint } from "./system-prompt.ts";',
      cwd,
    );
    expect(result).toBeDefined();
    expect((result as any).block).toBe(true);

    const reason = (result as any).reason!;
    expect(reason).toContain("Frozen rule");
    expect(reason).toContain("buildSystemPromptHint");
  });

  it("allows edit that modifies body without adding exports on frozen file", async () => {
    const cwd = path.join(FIXTURES, "frozen-test");
    await startSession(mock, cwd);

    const result = await doEdit(
      mock,
      "frozen.ts",
      [
        {
          oldText: "return 1;",
          newText: "return 2;",
        },
      ],
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });
});
