import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Dirent } from "node:fs";

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  parseFrontmatter: vi.fn(),
}));

import { readdir } from "node:fs/promises";
import * as fs from "node:fs";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { buildModuleIndex, findOwningModule } from "../../src/graph/module-index-builder.ts";

const mockedReaddir = readdir as unknown as ReturnType<typeof vi.fn>;
const mockedReadFileSync = vi.mocked(fs.readFileSync);
const mockedParseFrontmatter = vi.mocked(parseFrontmatter);

function makeDirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: "",
    path: "",
  } as Dirent;
}

describe("buildModuleIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds contracts from module.md files", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("src", true)] as Dirent[];
      if (d === "/project/src")
        return [makeDirent("module.md", false), makeDirent("app.ts", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("---\nvisible: [greet]\n---\nGreeting module.");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { visible: ["greet"], readonly: ["secret.ts"] },
      body: "Greeting module.",
    });

    const index = await buildModuleIndex("/project");

    expect(index.contracts).toHaveLength(1);
    expect(index.contracts[0].modulePath).toBe("/project/src");
    expect(index.contracts[0].visible).toEqual(["greet"]);
    expect(index.contracts[0].readonly).toContain("secret.ts");
    expect(index.contracts[0].prose).toBe("Greeting module.");
  });

  it("adds module.md to readonly implicitly", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("---\nreadonly: [config.json]\n---\nRoot.");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { readonly: ["config.json"] },
      body: "Root.",
    });

    const index = await buildModuleIndex("/project");

    expect(index.contracts[0].readonly).toContain("module.md");
    expect(index.contracts[0].readonly).toContain("config.json");
  });

  it("parses frontmatter with visible and readonly", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { visible: ["exportA", "exportB"], readonly: ["locked/"] },
      body: "Some prose.",
    });

    const index = await buildModuleIndex("/project");

    expect(index.contracts[0].visible).toEqual(["exportA", "exportB"]);
    expect(index.contracts[0].readonly).toContain("locked/");
    expect(index.contracts[0].prose).toBe("Some prose.");
  });

  it("sets visible to null when not specified in frontmatter", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { readonly: ["secret.ts"] },
      body: "No visible constraint.",
    });

    const index = await buildModuleIndex("/project");
    expect(index.contracts[0].visible).toBeNull();
  });

  it("deepest module.md wins directory ownership in dirToModule", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project")
        return [makeDirent("module.md", false), makeDirent("src", true)] as Dirent[];
      if (d === "/project/src")
        return [makeDirent("module.md", false), makeDirent("app.ts", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: {},
      body: "",
    });

    const index = await buildModuleIndex("/project");

    expect(index.contracts).toHaveLength(2);
    expect(index.dirToModule.get("/project/src")).toBe("/project/src");
    expect(index.dirToModule.get("/project")).toBe("/project");
  });

  it("matches module.md case-insensitively", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project")
        return [makeDirent("Module.MD", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");
    mockedParseFrontmatter.mockReturnValue({
      frontmatter: {},
      body: "Root.",
    });

    const index = await buildModuleIndex("/project");
    expect(index.contracts).toHaveLength(1);
    expect(index.contracts[0].modulePath).toBe("/project");
  });
});

describe("findOwningModule", () => {
  it("returns module for direct directory match", () => {
    const dirToModule = new Map<string, string>();
    dirToModule.set("/project/src/app", "/project/src");
    const index = { contracts: [], dirToModule };

    expect(findOwningModule("/project/src/app/file.ts", index)).toBe(
      "/project/src",
    );
  });

  it("walks up to find parent module", () => {
    const dirToModule = new Map<string, string>();
    dirToModule.set("/project/src", "/project/src");
    const index = { contracts: [], dirToModule };

    expect(
      findOwningModule("/project/src/sub/deep/file.ts", index),
    ).toBe("/project/src");
  });

  it("returns undefined for unowned files", () => {
    const dirToModule = new Map<string, string>();
    const index = { contracts: [], dirToModule };

    expect(findOwningModule("/project/other/file.ts", index)).toBeUndefined();
  });

  it("resolves file directly in module root", () => {
    const dirToModule = new Map<string, string>();
    dirToModule.set("/project", "/project");
    const index = { contracts: [], dirToModule };

    expect(findOwningModule("/project/config.ts", index)).toBe("/project");
  });

  it("returns deepest owning module", () => {
    const dirToModule = new Map<string, string>();
    dirToModule.set("/project", "/project");
    dirToModule.set("/project/src", "/project/src");
    const index = { contracts: [], dirToModule };

    expect(findOwningModule("/project/src/app.ts", index)).toBe(
      "/project/src",
    );
  });
});
