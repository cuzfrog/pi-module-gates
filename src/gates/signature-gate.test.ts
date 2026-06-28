import { describe, it, expect } from "vitest";
import { checkSignature } from "./signature-gate.ts";
import type { ModuleIndex, ModuleContract } from "../types.ts";
import "./signature-checkers/index.ts";

function makeIndex(contracts: ModuleContract[]): ModuleIndex {
  return { contracts, dirToModule: new Map() };
}

describe("checkSignature", () => {
  const cwd = "/project";

  it("blocks when locked function signature changes (add a param)", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [{ filePath: "app.ts", name: "keep" }],
        prose: "",
      },
    ]);

    const before = "export function keep(a: number) {}";
    const after = "export function keep(a: number, b: string) {}";
    const result = checkSignature("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("Signature rule");
      expect(result.reason).toContain("keep");
    }
  });

  it("allows body-only edit on a locked function", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [{ filePath: "app.ts", name: "keep" }],
        prose: "",
      },
    ]);

    const before = "export function keep(a: number) { return 1; }";
    const after = "export function keep(a: number) { return 2; }";
    const result = checkSignature("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("allows file not in any module's signatureLock", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [{ filePath: "other.ts", name: "keep" }],
        prose: "",
      },
    ]);

    const before = "export function keep(a: number) {}";
    const after = "export function keep(a: number, b: string) {}";
    const result = checkSignature("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("allows when no signature checker exists for the extension", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [{ filePath: "data.json", name: "Foo" }],
        prose: "",
      },
    ]);

    const result = checkSignature(
      "src/data.json",
      "{}",
      '{"a": 1}',
      index,
      cwd,
      "module.md",
    );

    expect(result.blocked).toBe(false);
  });

  it("checks ancestor module locks", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [{ filePath: "src/app.ts", name: "keep" }],
        prose: "",
      },
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [],
        prose: "",
      },
    ]);

    const before = "export function keep(a: number) {}";
    const after = "export function keep(a: number, b: string) {}";
    const result = checkSignature("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("keep");
    }
  });

  it("blocks when locked interface fields change", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [{ filePath: "app.ts", name: "Config" }],
        prose: "",
      },
    ]);

    const before = "export interface Config { a: number }";
    const after = "export interface Config { a: number; b: string }";
    const result = checkSignature("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
  });

  it("allows adding a new function that is not in the lock list", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [{ filePath: "app.ts", name: "keep" }],
        prose: "",
      },
    ]);

    const before = "export function keep(a: number) {}";
    const after = "export function keep(a: number) {}\nexport function newFn() {}";
    const result = checkSignature("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("reports all changed signatures in the reason string", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [
          { filePath: "app.ts", name: "alpha" },
          { filePath: "app.ts", name: "beta" },
        ],
        prose: "",
      },
    ]);

    const before = "export function alpha(a: number) {}\nexport function beta(x: string) {}";
    const after = "export function alpha(a: number, b: number) {}\nexport function beta(x: string, y: number) {}";
    const result = checkSignature("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("alpha");
      expect(result.reason).toContain("beta");
    }
  });

  it("returns unblocked when no lock entries match the file", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [{ filePath: "other.ts", name: "Foo" }],
        prose: "",
      },
    ]);

    const before = "export function unrelated() {}";
    const after = "export function unrelated(a: string) {}";
    const result = checkSignature("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("returns unblocked when index has no contracts", () => {
    const index = makeIndex([]);

    const before = "export function keep(a: number) {}";
    const after = "export function keep(a: number, b: string) {}";
    const result = checkSignature("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });

  it("blocks when locked type alias RHS changes", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [{ filePath: "app.ts", name: "Status" }],
        prose: "",
      },
    ]);

    const before = "export type Status = 'active' | 'inactive';";
    const after = "export type Status = 'active' | 'inactive' | 'pending';";
    const result = checkSignature("src/app.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(true);
  });

  it("does not fire on a sibling file edit", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        sealed: [],
        signatureLock: [{ filePath: "locked.ts", name: "keep" }],
        prose: "",
      },
    ]);

    const before = "export function keep(a: number) {}";
    const after = "export function keep(a: number, b: string) {}";
    const result = checkSignature("src/other.ts", before, after, index, cwd, "module.md");

    expect(result.blocked).toBe(false);
  });
});