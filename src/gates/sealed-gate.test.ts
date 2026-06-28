import { describe, it, expect } from "vitest";
import { checkSealed } from "./sealed-gate.ts";
import type { ModuleIndex, ModuleContract } from "../types.ts";
import "./checkers/typescript.ts";

function makeIndex(contracts: ModuleContract[]): ModuleIndex {
  return { contracts, dirToModule: new Map() };
}

describe("checkSealed", () => {
  const cwd = "/project";

  it("blocks when new export is added to sealed file", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: ["sealed.ts"],
        prose: "",
      },
    ]);

    const before = "export function existingFn() {}";
    const after = "export function existingFn() {}\nexport function newFn() {}";
    const result = checkSealed("src/sealed.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("Sealed rule");
      expect(result.reason).toContain("newFn");
    }
  });

  it("allows edit without new exports on sealed file", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: ["sealed.ts"],
        prose: "",
      },
    ]);

    const before = "export function existingFn() { return 1; }";
    const after = "export function existingFn() { return 2; }";
    const result = checkSealed("src/sealed.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("allows file not in sealed list", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: ["sealed.ts"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkSealed("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("allows when no checker exists for extension", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: ["data.json"],
        prose: "",
      },
    ]);

    const result = checkSealed(
      "src/data.json",
      "{}",
      '{"new": true}',
      index,
      cwd,
      "module.md",
    );

    expect(result.blocked).toBe(false);
  });

  it("checks ancestor module sealed patterns", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        visible: null,
        readonly: ["module.md"],
        sealed: ["src/sealed.ts"],
        prose: "",
      },
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        prose: "",
      },
    ]);

    const before = "export function existingFn() {}";
    const after = "export function existingFn() {}\nexport function newFn() {}";
    const result = checkSealed("src/sealed.ts", before, after, index, cwd, "module.md");

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
        sealed: ["vendor"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function newFn() {}";
    const result = checkSealed("src/vendor/lib.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
  });

  it("blocks new export matching glob pattern", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: ["generated*"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function newFn() {}";
    const result = checkSealed("src/generated-types.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
  });

  it("allows when index has no contracts", () => {
    const index = makeIndex([]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkSealed("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("allows when no sealed patterns match", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkSealed("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("reports all new export names in reason", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: ["sealed.ts"],
        prose: "",
      },
    ]);

    const before = "export function existingFn() {}";
    const after =
      "export function existingFn() {}\nexport function newA() {}\nexport type newB = string;";
    const result = checkSealed("src/sealed.ts", before, after, index, cwd, "module.md");

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
        sealed: [],
        prose: "",
      },
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: ["sealed.ts"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function newFn() {}";
    const result = checkSealed("src/sealed.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("src/module.md");
    }
  });
});