import { describe, it, expect, beforeEach } from "vitest";
import {
  MockExtensionAPI,
  MALFORMED,
  startSession,
  doWrite,
} from "./helpers.ts";
import mod from "../../src/index.ts";

describe("malformed frontmatter", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("warns on malformed module.md instead of crashing", async () => {
    const cwd = MALFORMED;
    await startSession(mock, cwd);

    const warnings = mock.notifications.filter(
      (n) => n.type === "warning",
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain("Failed to parse");
    expect(warnings[0].message).toContain("module.md");
    expect(warnings[0].message).toContain("unguarded");
  });

  it("treats malformed module as unguarded (writes allowed)", async () => {
    const cwd = MALFORMED;
    await startSession(mock, cwd);

    const result = await doWrite(mock, "any.ts", "// anything", cwd);
    expect(result?.block).toBeFalsy();
  });
});
