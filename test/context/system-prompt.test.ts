import { describe, it, expect } from "vitest";
import { buildSystemPromptHint } from "../../src/context/system-prompt.ts";
import type { ModuleIndex } from "../../src/types.ts";

describe("buildSystemPromptHint", () => {
  it("returns augmented prompt when contracts exist", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          visible: [{ name: "greet" }, { name: "Config" }],
          readonly: ["secret.ts", "module.md"],
        frozen: [],
          prose: "Greeting module.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "You are a helpful assistant.", "module.md", "file");

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

    const result = buildSystemPromptHint(index, "You are a helpful assistant.", "module.md", "file");

    expect(result).toBe("You are a helpful assistant.");
  });

  it("appends module descriptor section to prompt", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          visible: [{ name: "fnA" }],
          readonly: ["module.md"],
        frozen: [],
          prose: "Module A.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "Base prompt.", "CONTEXT.md", "file");

    expect(result).toContain("Base prompt.");
    expect(result).toContain("CONTEXT.md");
    expect(result.length).toBeGreaterThan("Base prompt.".length);
  });

  it("mentions frontmatter in note when mode is frontmatter", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          visible: [{ name: "fnA" }],
          readonly: ["module.md"],
          frozen: [],
          prose: "Module A.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "Base prompt.", "module.md", "frontmatter");

    expect(result).toContain("The frontmatter of");
    expect(result).toContain("is readonly");
  });

  it("omits descriptor note when mode is off", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          visible: [{ name: "fnA" }],
          readonly: ["config.ts"],
          frozen: [],
          prose: "Module A.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "Base prompt.", "module.md", "off");

    expect(result).not.toContain("is readonly");
  });
});
