import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  runGates,
  formatDenial,
  isDescriptorFile,
  extractFrontmatter,
} from "../../src/gates/run-gates.ts";
import "../../src/gates/checkers/index.ts";
import type { ModuleIndex, ModuleContract } from "../../src/types.ts";
import type { ModuleGateConfig } from "../../src/config.ts";

function makeIndex(
  contracts: ModuleContract[],
  dirToModule?: Map<string, string>,
): ModuleIndex {
  return { contracts, dirToModule: dirToModule ?? new Map() };
}

function cfg(over: Partial<ModuleGateConfig> = {}): ModuleGateConfig {
  return {
    moduleDescriptorFileName: "module.md",
    moduleDescriptorReadonly: "file",
    sourceRoot: "",
    disableModuleInterfaceImportGate: false,
    disableSystemPrompt: false,
    ...over,
  };
}

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pmg-rungates-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeSource(relativePath: string, content: string): string {
  const abs = path.join(tmp, relativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
  return abs;
}

describe("runGates", () => {
  it("returns undefined when no contracts exist", () => {
    writeSource("src/foo.ts", "");
    const index = makeIndex([]);
    const result = runGates("src/foo.ts", [{ oldText: "", newText: "" }], tmp, index, cfg());
    expect(result).toBeUndefined();
  });

  it("blocks readonly files", () => {
    writeSource("src/locked.ts", "");
    const index = makeIndex([
      { modulePath: path.join(tmp, "src"), visible: null, readonly: ["module.md", "locked.ts"], sealed: [], prose: "" },
    ]);
    const result = runGates("src/locked.ts", [{ oldText: "", newText: "x" }], tmp, index, cfg());
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("Readonly rule");
  });

  it("blocks sealed file when adding a new export", () => {
    writeSource("src/sealed.ts", "export function a() {}");
    const index = makeIndex([
      { modulePath: path.join(tmp, "src"), visible: null, readonly: ["module.md"], sealed: ["sealed.ts"], prose: "" },
    ]);
    const after = "export function a() {}\nexport function b() {}";
    const result = runGates("src/sealed.ts", [{ oldText: "export function a() {}", newText: after }], tmp, index, cfg());
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("Sealed rule");
    expect(result?.reason).toContain("b");
  });

  it("blocks exports not in visible list", () => {
    writeSource("src/app.ts", "export function a() {}");
    const index = makeIndex([
      { modulePath: path.join(tmp, "src"), visible: [{ name: "a" }], readonly: [], sealed: [], prose: "" },
    ]);
    const after = "export function a() {}\nexport function b() {}";
    const result = runGates("src/app.ts", [{ oldText: "export function a() {}", newText: after }], tmp, index, cfg());
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("b");
  });

  it("returns undefined when edit does not add exports on sealed file", () => {
    writeSource("src/sealed.ts", "export function a() { return 1; }");
    const index = makeIndex([
      { modulePath: path.join(tmp, "src"), visible: null, readonly: [], sealed: ["sealed.ts"], prose: "" },
    ]);
    const result = runGates(
      "src/sealed.ts",
      [{ oldText: "return 1;", newText: "return 2;" }],
      tmp,
      index,
      cfg(),
    );
    expect(result).toBeUndefined();
  });
});

describe("formatDenial", () => {
  it("includes module prose when contract has prose", () => {
    const modulePath = path.join(tmp, "src");
    const index: ModuleIndex = {
      contracts: [
        { modulePath, visible: null, readonly: ["locked.ts"], sealed: [], prose: "Greeting module." },
      ],
      dirToModule: new Map([[modulePath, modulePath]]),
    };
    const formatted = formatDenial("src/locked.ts", "Readonly rule", path.join(modulePath, "locked.ts"), index, tmp, "module.md");
    expect(formatted).toContain("[Module Gate]");
    expect(formatted).toContain("Greeting module.");
  });
});

describe("isDescriptorFile", () => {
  it("matches case-insensitively", () => {
    expect(isDescriptorFile("/p/src/MODULE.md", "module.md")).toBe(true);
    expect(isDescriptorFile("/p/src/module.md", "MODULE.md")).toBe(true);
    expect(isDescriptorFile("/p/src/other.ts", "module.md")).toBe(false);
  });
});

describe("extractFrontmatter", () => {
  it("returns empty object on malformed input", () => {
    expect(extractFrontmatter("not yaml")).toEqual({});
  });

  it("parses valid frontmatter", () => {
    const fm = extractFrontmatter("---\nreadonly: [x]\n---\nbody");
    expect(fm).toMatchObject({ readonly: ["x"] });
  });
});