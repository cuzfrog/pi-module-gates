import { describe, it, expect } from "vitest";
import { checkFrozen } from "../../src/gates/frozen-gate.ts";
import type { ModuleIndex, ModuleContract } from "../../src/types.ts";
import "../../src/gates/checkers/typescript.ts";

function makeIndex(contracts: ModuleContract[]): ModuleIndex {
  return { contracts, dirToModule: new Map() };
}

describe("checkFrozen", () => {
  const cwd = "/project";

  it("blocks when new export is added to frozen file", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: ["frozen.ts"],
        prose: "",
      },
    ]);

    const before = "export function existingFn() {}";
    const after = "export function existingFn() {}\nexport function newFn() {}";
    const result = checkFrozen("src/frozen.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("Frozen rule");
      expect(result.reason).toContain("newFn");
    }
  });

  it("allows edit without new exports on frozen file", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: ["frozen.ts"],
        prose: "",
      },
    ]);

    const before = "export function existingFn() { return 1; }";
    const after = "export function existingFn() { return 2; }";
    const result = checkFrozen("src/frozen.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("allows file not in frozen list", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: ["frozen.ts"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkFrozen("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("allows when no checker exists for extension", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: ["data.json"],
        prose: "",
      },
    ]);

    const result = checkFrozen(
      "src/data.json",
      "{}",
      '{"new": true}',
      index,
      cwd,
      "module.md",
    );

    expect(result.blocked).toBe(false);
  });

  it("checks ancestor module frozen patterns", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        visible: null,
        readonly: ["module.md"],
        frozen: ["src/frozen.ts"],
        prose: "",
      },
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: [],
        prose: "",
      },
    ]);

    const before = "export function existingFn() {}";
    const after = "export function existingFn() {}\nexport function newFn() {}";
    const result = checkFrozen("src/frozen.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("newFn");
    }
  });

  it("blocks new export matching directory pattern", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: ["vendor"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function newFn() {}";
    const result = checkFrozen("src/vendor/lib.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
  });

  it("blocks new export matching glob pattern", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: ["generated*"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function newFn() {}";
    const result = checkFrozen("src/generated-types.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
  });

  it("allows when index has no contracts", () => {
    const index = makeIndex([]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkFrozen("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("allows when no frozen patterns match", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkFrozen("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("reports all new export names in reason", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: ["frozen.ts"],
        prose: "",
      },
    ]);

    const before = "export function existingFn() {}";
    const after =
      "export function existingFn() {}\nexport function newA() {}\nexport type newB = string;";
    const result = checkFrozen("src/frozen.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("newA");
      expect(result.reason).toContain("newB");
    }
  });

  it("pinpoints immediate module in ancestor chain", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        visible: null,
        readonly: ["module.md"],
        frozen: [],
        prose: "",
      },
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: ["frozen.ts"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function newFn() {}";
    const result = checkFrozen("src/frozen.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("src/module.md");
    }
  });
});
