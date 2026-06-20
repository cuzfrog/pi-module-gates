import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { execSync } from "node:child_process";

const scriptPath = join(
  import.meta.dirname,
  "..",
  "..",
  "skills",
  "module-freeze-all",
  "scripts",
  "freeze-all.mjs",
);

function runScript(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execSync(`node ${scriptPath} ${args.join(" ")}`, {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
    });
    return { stdout, stderr: "", status: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (err.stdout ?? "").toString(),
      stderr: (err.stderr ?? "").toString(),
      status: err.status ?? 1,
    };
  }
}

function setupFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "module-freeze-all-test-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "src", "sub"), { recursive: true });
  return dir;
}

function cleanupFixture(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

describe("freeze-all.mjs", () => {
  it("adds frozen entries to existing module.md", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\nvisible: [greet]\n---\n\nSome prose.\n",
    );
    writeFileSync(join(dir, "src", "app.ts"), "export function greet() {}");
    writeFileSync(join(dir, "src", "utils.ts"), "export function helper() {}");
    // subdir with files but no module.md — should NOT be included
    writeFileSync(join(dir, "src", "sub", "nested.ts"), "export const x = 1");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(updated).toContain("frozen:");
    expect(updated).toContain("app.ts");
    expect(updated).toContain("utils.ts");
    expect(updated).not.toContain("nested.ts");

    // Should preserve existing fields
    expect(updated).toContain("visible:");
    expect(updated).toContain("greet");
    expect(updated).toContain("Some prose.");

    cleanupFixture(dir);
  });

  it("preserves existing frozen entries when adding new ones", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\nfrozen:\n  - existing.ts\n---\n\n",
    );
    writeFileSync(join(dir, "src", "existing.ts"), "");
    writeFileSync(join(dir, "src", "new-file.ts"), "");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(updated).toContain("existing.ts");
    expect(updated).toContain("new-file.ts");

    // existing should appear before new-file
    const existingIdx = updated.indexOf("existing.ts");
    const newIdx = updated.indexOf("new-file.ts");
    expect(existingIdx).toBeLessThan(newIdx);

    cleanupFixture(dir);
  });

  it("skips sub-module directories", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\n---\n\n",
    );
    writeFileSync(join(dir, "src", "app.ts"), "");
    writeFileSync(join(dir, "src", "sub", "module.md"), "---\n---\n\n");
    writeFileSync(join(dir, "src", "sub", "child.ts"), "");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const parent = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(parent).toContain("app.ts");
    expect(parent).not.toContain("child.ts");

    const child = readFileSync(join(dir, "src", "sub", "module.md"), "utf-8");
    expect(child).toContain("child.ts");

    cleanupFixture(dir);
  });

  it("idempotent: running twice produces same result", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\nvisible: [greet]\n---\n\n",
    );
    writeFileSync(join(dir, "src", "app.ts"), "");

    runScript(dir, ["--root", "src"]);
    const firstRun = readFileSync(join(dir, "src", "module.md"), "utf-8");

    runScript(dir, ["--root", "src"]);
    const secondRun = readFileSync(join(dir, "src", "module.md"), "utf-8");

    expect(secondRun).toBe(firstRun);

    cleanupFixture(dir);
  });

  it("dry-run does not modify files", () => {
    const dir = setupFixture();

    const original = "---\nvisible: [greet]\n---\n\n";
    writeFileSync(join(dir, "src", "module.md"), original);
    writeFileSync(join(dir, "src", "app.ts"), "");

    const result = runScript(dir, ["--root", "src", "--dry-run"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Dry run");

    const content = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(content).toBe(original);

    cleanupFixture(dir);
  });

  it("reports no changes when all up to date", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\nfrozen:\n  - app.ts\n---\n\n",
    );
    writeFileSync(join(dir, "src", "app.ts"), "");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("up to date");

    cleanupFixture(dir);
  });

  it("--create adds module.md to directories without one", () => {
    const dir = setupFixture();

    writeFileSync(join(dir, "src", "app.ts"), "");
    writeFileSync(join(dir, "src", "utils.ts"), "");

    // No module.md exists
    expect(existsSync(join(dir, "src", "module.md"))).toBe(false);

    const result = runScript(dir, ["--root", "src", "--create"]);
    expect(result.status).toBe(0);

    const created = readFileSync(join(dir, "src", "MODULE.md"), "utf-8");
    expect(created).toContain("frozen:");
    expect(created).toContain("app.ts");
    expect(created).toContain("utils.ts");

    cleanupFixture(dir);
  });

  it("handles module.md without frontmatter gracefully", () => {
    const dir = setupFixture();

    writeFileSync(join(dir, "src", "module.md"), "Just prose, no frontmatter.\n");
    writeFileSync(join(dir, "src", "app.ts"), "");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(updated).toContain("frozen:");
    expect(updated).toContain("app.ts");
    expect(updated).toContain("Just prose");

    cleanupFixture(dir);
  });

  it("handles custom descriptor name", () => {
    const dir = setupFixture();

    writeFileSync(join(dir, "src", "MODULE.md"), "---\n---\n\n");
    writeFileSync(join(dir, "src", "app.ts"), "");

    const result = runScript(dir, ["--root", "src", "--descriptor-name", "MODULE.md"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "MODULE.md"), "utf-8");
    expect(updated).toContain("app.ts");

    cleanupFixture(dir);
  });

  it("errors on non-existent root", () => {
    const dir = setupFixture();
    const result = runScript(dir, ["--root", "nonexistent"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not found");
    cleanupFixture(dir);
  });

  it("skips module.md when directory has no files", () => {
    const dir = setupFixture();
    mkdirSync(join(dir, "src", "empty"), { recursive: true });

    const original = "---\n---\n\n";
    writeFileSync(join(dir, "src", "empty", "module.md"), original);

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("up to date");

    const updated = readFileSync(join(dir, "src", "empty", "module.md"), "utf-8");
    expect(updated).toBe(original);

    cleanupFixture(dir);
  });

  it("filters out files with unsupported extensions by default", () => {
    const dir = setupFixture();

    writeFileSync(join(dir, "src", "module.md"), "---\n---\n\n");
    writeFileSync(join(dir, "src", "app.ts"), "");
    writeFileSync(join(dir, "src", "main.go"), "");
    writeFileSync(join(dir, "src", "lib.rs"), "");
    writeFileSync(join(dir, "src", "README.md"), "readme");
    writeFileSync(join(dir, "src", "package.json"), "{}");
    writeFileSync(join(dir, "src", "notes.txt"), "notes");
    writeFileSync(join(dir, "src", "config.yaml"), "key: val");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(updated).toContain("app.ts");
    expect(updated).toContain("main.go");
    expect(updated).toContain("lib.rs");
    expect(updated).not.toContain("README.md");
    expect(updated).not.toContain("package.json");
    expect(updated).not.toContain("notes.txt");
    expect(updated).not.toContain("config.yaml");

    cleanupFixture(dir);
  });

  it("preserves existing frozen entries with unsupported extensions", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\nfrozen:\n  - docs.md\n---\n\n",
    );
    writeFileSync(join(dir, "src", "docs.md"), "doc");
    writeFileSync(join(dir, "src", "app.ts"), "");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(updated).toContain("docs.md");
    expect(updated).toContain("app.ts");
    // docs.md should come first since it was an existing entry
    const docsIdx = updated.indexOf("docs.md");
    const appIdx = updated.indexOf("app.ts");
    expect(docsIdx).toBeLessThan(appIdx);

    cleanupFixture(dir);
  });
});
