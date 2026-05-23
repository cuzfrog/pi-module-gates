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
  it("returns name-only entry for single token", () => {
    expect(parseVisibleEntry("Foo")).toEqual({ name: "Foo" });
  });

  it("returns name-only entry for whitespace-only string", () => {
    expect(parseVisibleEntry("   ")).toEqual({ name: "   " });
  });

  it("returns name-only entry for empty string", () => {
    expect(parseVisibleEntry("")).toEqual({ name: "" });
  });

  it("last token is name, everything before is modifier", () => {
    expect(parseVisibleEntry("pub Foo")).toEqual({ modifier: "pub", name: "Foo" });
  });

  it("handles modifier containing special chars like parens", () => {
    expect(parseVisibleEntry("pub(super) Foo")).toEqual({
      modifier: "pub(super)",
      name: "Foo",
    });
  });

  it("handles multi-word modifier", () => {
    expect(parseVisibleEntry("pub(super) override Foo")).toEqual({
      modifier: "pub(super) override",
      name: "Foo",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseVisibleEntry("  pub Foo  ")).toEqual({
      modifier: "pub",
      name: "Foo",
    });
  });

  it("collapses internal whitespace", () => {
    expect(parseVisibleEntry("pub   Foo")).toEqual({
      modifier: "pub",
      name: "Foo",
    });
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
