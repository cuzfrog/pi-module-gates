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

  it("returns defaults when config file does not exist", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.sourceRoot).toBe("src/");
  });

  it("returns defaults when config file has invalid JSON", () => {
    mockedReadFileSync.mockReturnValue("{ broken");

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.sourceRoot).toBe("src/");
  });

  it("overrides defaults with user values", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        moduleDescriptorFileName: "CONTEXT.md",
        sourceRoot: "lib/",
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("CONTEXT.md");
    expect(config.sourceRoot).toBe("lib/");
  });

  it("overrides only provided keys", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        moduleDescriptorFileName: "CONTEXT.md",
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("CONTEXT.md");
    expect(config.sourceRoot).toBe("src/");
  });

  it("reads from .pi/module-gate-config.json relative to cwd", () => {
    mockedReadFileSync.mockReturnValue("{}");

    loadConfig("/my/project");
    expect(mockedReadFileSync).toHaveBeenCalledWith(
      "/my/project/.pi/module-gate-config.json",
      "utf-8",
    );
  });
});
