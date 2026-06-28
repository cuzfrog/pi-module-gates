import { describe, it, expect } from "vitest";
import { getSignatureChecker } from "./registry.ts";
import "./typescript.ts";

describe("TypeScript signature checker", () => {
  const checker = getSignatureChecker("/file.ts")!;

  it("captures function signature text including params", () => {
    const sigs = checker.getSignatures("export function foo(a: number, b: string): boolean {}");
    expect(sigs.get("foo")).toBe("export function foo(a: number, b: string): boolean");
  });

  it("captures async function signature", () => {
    const sigs = checker.getSignatures("export async function fetchData(url: string): Promise<void> {}");
    expect(sigs.get("fetchData")).toBe("export async function fetchData(url: string): Promise<void>");
  });

  it("captures overload signatures joined by newline", () => {
    const src = [
      "export function bar(x: number): void;",
      "export function bar(x: string): void;",
      "export function bar(x: number | string): void { return; }",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    const text = sigs.get("bar");
    expect(text).toBeDefined();
    expect(text).toContain("export function bar(x: number): void");
    expect(text).toContain("export function bar(x: string): void");
  });

  it("captures class head only and excludes body", () => {
    const src = "export class Greeter<T> extends BaseGreeter implements Greetable { greet() { return 1; } }";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("Greeter");
    expect(text).toBeDefined();
    expect(text).toContain("class Greeter");
    expect(text).toContain("extends BaseGreeter");
    expect(text).toContain("implements Greetable");
    expect(text).not.toContain("greet()");
  });

  it("captures interface body in full", () => {
    const src = "export interface Config { port: number; host: string }";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("Config");
    expect(text).toBe(src);
  });

  it("captures type alias RHS up to semicolon", () => {
    const src = "export type Status = 'active' | 'inactive';";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("Status")).toBe(src);
  });

  it("captures generic params in function signature", () => {
    const src = "export function merge<T extends object>(a: T, b: T): T { return a; }";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("merge");
    expect(text).toBeDefined();
    expect(text).toContain("<T extends object>");
    expect(text).toContain("(a: T, b: T): T");
  });

  it("captures default param values", () => {
    const sigs = checker.getSignatures("export function greet(name: string = 'world'): string { return name; }");
    expect(sigs.get("greet")).toBe("export function greet(name: string = 'world'): string");
  });

  it("strips decorators from the captured head", () => {
    const src = "@sealed\nexport class Greeter { greet() {} }";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("Greeter");
    expect(text).toBeDefined();
    expect(text).not.toContain("@sealed");
    expect(text).toContain("class Greeter");
  });

  it("excludes re-exports from the signature map", () => {
    const sigs = checker.getSignatures('export { Foo } from "./foo";');
    expect(sigs.has("Foo")).toBe(false);
  });

  it("handles declare modifier for functions", () => {
    const src = "export declare function init(): void;";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("init");
    expect(text).toBeDefined();
    expect(text).toContain("declare function init()");
    expect(text).toContain(": void");
  });

  it("handles generator function signature", () => {
    const sigs = checker.getSignatures("export function* gen(): Generator<number> { yield 1; }");
    const text = sigs.get("gen");
    expect(text).toBeDefined();
    expect(text).toContain("function*");
    expect(text).toContain("Generator<number>");
  });

  it("handles indented declarations", () => {
    const src = "  export function indented(x: number): void {}";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("indented")).toBe("export function indented(x: number): void");
  });

  it("does not include value bindings (export const) as signatures", () => {
    const sigs = checker.getSignatures("export const VALUE = 42;");
    expect(sigs.has("VALUE")).toBe(false);
  });

  it("captures multiple signatures in one file", () => {
    const src = [
      "export function alpha(): void {}",
      "export class Beta {}",
      "export interface Gamma {}",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect(sigs.has("alpha")).toBe(true);
    expect(sigs.has("Beta")).toBe(true);
    expect(sigs.has("Gamma")).toBe(true);
  });

  it("captures declare interface body", () => {
    const src = "export declare interface Plugin { name: string }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("Plugin")).toBe(src);
  });
});