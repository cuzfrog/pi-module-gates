import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

import { loadConfig } from "../src/config.ts";

const mockedReadFileSync = vi.mocked(fs.readFileSync);

describe("loadConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when settings.json does not exist", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.moduleDescriptorReadonly).toBe("file");
    expect(config.sourceRoot).toBe("src/");
  });

  it("returns defaults when settings.json has no module-gate key", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ theme: "dark" }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.moduleDescriptorReadonly).toBe("file");
    expect(config.sourceRoot).toBe("src/");
  });

  it("returns defaults when settings.json has invalid JSON", () => {
    mockedReadFileSync.mockReturnValue("{ broken");

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.moduleDescriptorReadonly).toBe("file");
    expect(config.sourceRoot).toBe("src/");
  });

  it("overrides defaults with module-gate values", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gate": {
          moduleDescriptorFileName: "CONTEXT.md",
          moduleDescriptorReadonly: "off",
          sourceRoot: "lib/",
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("CONTEXT.md");
    expect(config.moduleDescriptorReadonly).toBe("off");
    expect(config.sourceRoot).toBe("lib/");
  });

  it("overrides only provided keys in module-gate", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gate": {
          moduleDescriptorFileName: "CONTEXT.md",
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("CONTEXT.md");
    expect(config.moduleDescriptorReadonly).toBe("file");
    expect(config.sourceRoot).toBe("src/");
  });

  it("accepts frontmatter mode", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gate": {
          moduleDescriptorReadonly: "frontmatter",
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
  });

  it("normalizes boolean true to file mode", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gate": {
          moduleDescriptorReadonly: true,
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorReadonly).toBe("file");
  });

  it("normalizes boolean false to off mode", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gate": {
          moduleDescriptorReadonly: false,
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorReadonly).toBe("off");
  });

  it("reads from .pi/settings.json relative to cwd", () => {
    mockedReadFileSync.mockReturnValue("{}");

    loadConfig("/my/project");
    expect(mockedReadFileSync).toHaveBeenCalledWith(
      "/my/project/.pi/settings.json",
      "utf-8",
    );
  });
});
