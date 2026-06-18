import { describe, it, expect, beforeEach, vi } from "vitest";
import * as path from "node:path";
import {
  MockExtensionAPI,
  FIXTURES,
  startSession,
  doWrite,
} from "./helpers.ts";

vi.mock("../../src/config.ts", () => ({
  loadConfig: () => ({
    moduleDescriptorFileName: "module.md",
    moduleDescriptorReadonly: "file",
    sourceRoot: "",
    disableModuleInterfaceImportGate: false,
  }),
}));

import mod from "../../src/index.ts";

describe("module interface import gating", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("blocks write that imports from non-interface file in a sibling module", async () => {
    const cwd = FIXTURES;
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "src/app.ts",
      'import { helper } from "../other/helper";\n',
      cwd,
    );

    expect((result as any).block).toBe(true);
    expect((result as any).reason).toContain("helper.ts");
  });

  it("allows write that imports from child module internal file", async () => {
    const cwd = FIXTURES;
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "src/app.ts",
      'import { secret } from "./internal/secrets";\n',
      cwd,
    );

    expect(result?.block).toBeFalsy();
  });
});
