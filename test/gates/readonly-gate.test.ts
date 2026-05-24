import { describe, it, expect } from "vitest";
import { checkReadonly } from "../../src/gates/readonly-gate.ts";
import type { ModuleIndex, ModuleContract } from "../../src/types.ts";

function makeIndex(contracts: ModuleContract[]): ModuleIndex {
  return { contracts, dirToModule: new Map() };
}

describe("checkReadonly", () => {
  const cwd = "/project";

  it("blocks file matching exact readonly entry", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["config.json", "module.md"],
        frozen: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/config.json", index, cwd, "module.md");
    expect(result.blocked).toBe(true);
  });

  it("blocks file under a readonly directory", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["vendor", "module.md"],
        frozen: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/vendor/lib.ts", index, cwd, "module.md");
    expect(result.blocked).toBe(true);
  });

  it("blocks file matching glob pattern (wildcard suffix)", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["generated*", "module.md"],
        frozen: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/generated-types.ts", index, cwd, "module.md");
    expect(result.blocked).toBe(true);
  });

  it("passes file not matching any pattern", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["config.json", "module.md"],
        frozen: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/app.ts", index, cwd, "module.md");
    expect(result.blocked).toBe(false);
  });

  it("always blocks module.md itself", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["module.md"],
        frozen: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/module.md", index, cwd, "module.md");
    expect(result.blocked).toBe(true);
  });

  it("checks ancestor module readonly patterns", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        visible: null,
        readonly: ["src/secret.ts", "module.md"],
        frozen: [],
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

    const result = checkReadonly("src/secret.ts", index, cwd, "module.md");
    expect(result.blocked).toBe(true);
  });

  it("provides reason mentioning descriptor file name when blocked", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        visible: null,
        readonly: ["locked.ts", "CONTEXT.md"],
        frozen: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/locked.ts", index, cwd, "CONTEXT.md");
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("CONTEXT.md");
    }
  });
});
