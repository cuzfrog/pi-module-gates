import { describe, it, expect } from "vitest";
import { buildSystemPromptHint } from "../../src/context/system-prompt.ts";
import type { ModuleIndex } from "../../src/types.ts";

describe("buildSystemPromptHint", () => {
  it("returns augmented prompt when contracts exist", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          visible: ["greet", "Config"],
          readonly: ["secret.ts", "module.md"],
          prose: "Greeting module.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "You are a helpful assistant.");

    expect(result).toContain("You are a helpful assistant.");
    expect(result).toContain("module.md");
    expect(result).toContain("visible");
    expect(result).toContain("readonly");
  });

  it("returns original prompt when no contracts", () => {
    const index: ModuleIndex = {
      contracts: [],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "You are a helpful assistant.");

    expect(result).toBe("You are a helpful assistant.");
  });

  it("appends module descriptor section to prompt", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          visible: ["fnA"],
          readonly: ["module.md"],
          prose: "Module A.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "Base prompt.");

    expect(result).toContain("Base prompt.");
    expect(result.length).toBeGreaterThan("Base prompt.".length);
  });
});
