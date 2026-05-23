import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import { findOwningModule, readFileSafe, applyEdits, parseVisibleEntry, isWithinSourceRoot } from "../src/utils.ts";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

const mockedReadFileSync = vi.mocked(fs.readFileSync);

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

describe("readFileSafe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns file content on success", () => {
    mockedReadFileSync.mockReturnValue("hello world");

    expect(readFileSafe("/some/file.ts")).toBe("hello world");
  });

  it("returns empty string on error", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    expect(readFileSafe("/nonexistent.ts")).toBe("");
  });
});

describe("applyEdits", () => {
  it("applies a single edit", () => {
    const result = applyEdits("hello world", [
      { oldText: "world", newText: "there" },
    ]);
    expect(result).toBe("hello there");
  });

  it("applies multiple edits sequentially", () => {
    const result = applyEdits("a b c", [
      { oldText: "a", newText: "x" },
      { oldText: "c", newText: "z" },
    ]);
    expect(result).toBe("x b z");
  });

  it("returns original content when no edits match", () => {
    const result = applyEdits("hello", [
      { oldText: "xyz", newText: "abc" },
    ]);
    expect(result).toBe("hello");
  });

  it("returns original content for empty edits array", () => {
    expect(applyEdits("hello", [])).toBe("hello");
  });

  it("only replaces first occurrence per edit", () => {
    const result = applyEdits("a a a", [
      { oldText: "a", newText: "b" },
    ]);
    // String.replace without /g only replaces first occurrence
    expect(result).toBe("b a a");
  });
});

describe("parseVisibleEntry", () => {
  it("parses bare string as path with extracted name", () => {
    expect(parseVisibleEntry("Foo")).toEqual({ name: "Foo", path: "Foo" });
  });

  it("extracts name from sub-path bare string", () => {
    expect(parseVisibleEntry("sub/Helper")).toEqual({ name: "Helper", path: "sub/Helper" });
  });

  it("extracts name from bare string with trailing slash (dir reference)", () => {
    expect(parseVisibleEntry("sub/mod1/")).toEqual({ name: "mod1", path: "sub/mod1/" });
  });

  it("parses object form with path and modifier", () => {
    expect(parseVisibleEntry({ path: "sub/Type", modifier: "pub(super)" })).toEqual({
      name: "Type",
      modifier: "pub(super)",
      path: "sub/Type",
    });
  });

  it("parses object form with path only, no modifier", () => {
    expect(parseVisibleEntry({ path: "Foo" })).toEqual({
      name: "Foo",
      path: "Foo",
    });
  });

  it("parses object form with trailing slash", () => {
    expect(parseVisibleEntry({ path: "sub/mod1/" })).toEqual({
      name: "mod1",
      path: "sub/mod1/",
    });
  });

  it("trims whitespace from bare string", () => {
    expect(parseVisibleEntry("  Foo  ")).toEqual({ name: "Foo", path: "Foo" });
  });

  it("handles empty string", () => {
    expect(parseVisibleEntry("")).toEqual({ name: "", path: "" });
  });
});

describe("isWithinSourceRoot", () => {
  it("returns true for file inside sourceRoot", () => {
    expect(isWithinSourceRoot("/project/src/app/file.ts", "/project/src")).toBe(true);
  });

  it("returns true for file exactly at sourceRoot", () => {
    expect(isWithinSourceRoot("/project/src", "/project/src")).toBe(true);
  });

  it("returns false for file outside sourceRoot", () => {
    expect(isWithinSourceRoot("/project/lib/app.ts", "/project/src")).toBe(false);
  });

  it("returns false for similarly-named sibling directory", () => {
    expect(isWithinSourceRoot("/project/src-other/file.ts", "/project/src")).toBe(false);
  });

  it("returns true for file at project root when sourceRoot is empty string", () => {
    expect(isWithinSourceRoot("/project/app.ts", "/project")).toBe(true);
  });

  it("returns true for file exactly at filesystem root", () => {
    expect(isWithinSourceRoot("/", "/")).toBe(true);
  });

  it("returns false for file in root when resolvedRoot is a child path", () => {
    expect(isWithinSourceRoot("/project", "/project/src")).toBe(false);
  });
});
