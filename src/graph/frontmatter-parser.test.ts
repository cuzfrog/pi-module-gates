import { describe, it, expect } from "vitest";
import { parseVisibleEntry } from "./frontmatter-parser.ts";

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
