import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

let tmp: string;
beforeEach(() => {
  vi.resetModules();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pmg-index-loader-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  vi.doUnmock("../graph/index.ts");
  vi.restoreAllMocks();
});

describe("loadIndexForHook", () => {
  it("returns an empty index when buildModuleIndex throws", async () => {
    vi.doMock("../graph/index.ts", () => ({
      buildModuleIndex: () => {
        throw new Error("boom");
      },
    }));
    const mod = await import("./index-loader.ts");
    const result = await mod.loadIndexForHook(tmp);
    expect(result.index.contracts).toEqual([]);
    expect(result.index.dirToModule.size).toBe(0);
    expect(result.config.moduleDescriptorFileName).toBe("module.md");
  });

  it("returns the built index on success", async () => {
    fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src", "app.ts"), "");
    fs.writeFileSync(
      path.join(tmp, "src", "module.md"),
      "---\nvisible: [greet]\n---\nGreeting module.\n",
      "utf-8",
    );
    const mod = await import("./index-loader.ts");
    const result = await mod.loadIndexForHook(tmp);
    expect(result.index.contracts.length).toBeGreaterThanOrEqual(1);
    expect(result.config.moduleDescriptorFileName).toBe("module.md");
  });
});

describe("notifyNoContracts", () => {
  it("writes the expected line via the ctx notify", async () => {
    const mod = await import("./index-loader.ts");
    const recorded: string[] = [];
    mod.notifyNoContracts({
      cwd: "/tmp",
      ui: { notify: (m) => recorded.push(m) },
    });
    expect(recorded).toEqual(["No module descriptor files found. Gates are not active."]);
  });
});
