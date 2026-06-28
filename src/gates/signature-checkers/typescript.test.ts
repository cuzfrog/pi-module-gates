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

  it("captures enum body in full", () => {
    const src = "export enum Color { Red = 1, Blue = 2 }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("Color")).toBe(src);
  });

  it("captures const enum body in full", () => {
    const src = "export const enum Dir { Up = 1, Down = 2 }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("Dir")).toBe(src);
  });

  it("captures declare enum body in full", () => {
    const src = "export declare enum Mode { A, B }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("Mode")).toBe(src);
  });

  it("captures namespace body in full", () => {
    const src = "export namespace N { export const x = 1; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("N")).toBe(src);
  });

  it("captures declare namespace body in full", () => {
    const src = "export declare namespace N { type T = number; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("N")).toBe(src);
  });

  it("captures mixed declarations in one file", () => {
    const src = [
      "export enum Color { Red }",
      "export namespace N { export const x = 1; }",
      "export interface I {}",
      "export type T = number;",
      "export function f(): void {}",
      "export class C {}",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect([...sigs.keys()].sort()).toEqual(["C", "Color", "I", "N", "T", "f"].sort());
  });

  it("captures union return type", () => {
    const sigs = checker.getSignatures("export function f(): string | null { return null; }");
    expect(sigs.get("f")).toBe("export function f(): string | null");
  });

  it("captures rest parameter", () => {
    const sigs = checker.getSignatures("export function f(...args: number[]): number { return args.length; }");
    expect(sigs.get("f")).toBe("export function f(...args: number[]): number");
  });

  it("captures destructured parameter", () => {
    const sigs = checker.getSignatures("export function f({ a, b }: { a: string; b: number }): void {}");
    expect(sigs.get("f")).toBe("export function f({ a, b }: { a: string; b: number }): void");
  });

  it("captures optional parameter", () => {
    const sigs = checker.getSignatures("export function f(x?: number): number { return x ?? 0; }");
    expect(sigs.get("f")).toBe("export function f(x?: number): number");
  });

  it("captures function type alias", () => {
    const src = "export type Handler = (e: Event) => void;";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("Handler")).toBe(src);
  });

  it("captures conditional type alias", () => {
    const src = "export type IsString<T> = T extends string ? true : false;";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("IsString")).toBe(src);
  });

  it("captures mapped type alias", () => {
    const src = "export type Readonly<T> = { readonly [K in keyof T]: T[K] };";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("Readonly")).toBe(src);
  });

  it("captures index signature inside interface", () => {
    const src = "export interface Dict { [key: string]: number }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("Dict")).toBe(src);
  });

  it("does not extract arrow const value binding as a signature", () => {
    const sigs = checker.getSignatures("export const f = (x: number): number => x;");
    expect(sigs.has("f")).toBe(false);
  });

  it("captures abstract class head", () => {
    const src = "export abstract class Greeter { abstract greet(): void; }";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("Greeter");
    expect(text).toBeDefined();
    expect(text).toContain("abstract class Greeter");
    expect(text).not.toContain("abstract greet()");
  });

  it("captures abstract class head with multi-line extends and implements", () => {
    const src = "export abstract class C\n  extends Base\n  implements I1, I2 {}";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("C");
    expect(text).toBeDefined();
    expect(text).toContain("abstract class C");
    expect(text).toContain("extends Base");
    expect(text).toContain("implements I1, I2");
  });

  it("captures declare class head", () => {
    const src = "export declare class C { x: number; foo(): void; }";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("C");
    expect(text).toBeDefined();
    expect(text).toContain("declare class C");
    expect(text).not.toContain("foo()");
  });

  it("captures class with multi-line extends and implements", () => {
    const src = "export class C\n  extends Base\n  implements I {}";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("C");
    expect(text).toBeDefined();
    expect(text).toContain("class C");
    expect(text).toContain("extends Base");
    expect(text).toContain("implements I");
  });

  it("captures class with generic default in type parameter", () => {
    const src = "export class Box<T = string> { value: T; }";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("Box");
    expect(text).toBeDefined();
    expect(text).toContain("class Box<T = string>");
  });

  it("captures async generator function signature", () => {
    const sigs = checker.getSignatures("export async function* gen(): AsyncGenerator<number> { yield 1; }");
    const text = sigs.get("gen");
    expect(text).toBeDefined();
    expect(text).toContain("async function*");
    expect(text).toContain("AsyncGenerator<number>");
  });

  it("captures function with this parameter", () => {
    const sigs = checker.getSignatures("export function f(this: Window, x: number): void {}");
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("this: Window");
    expect(text).toContain("x: number): void");
  });

  it("captures function with destructured this and param", () => {
    const sigs = checker.getSignatures("export function f(this: Window, { x, y }: Point): void {}");
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("this: Window");
    expect(text).toContain("{ x, y }: Point");
  });

  it("captures function with trailing comma in params", () => {
    const sigs = checker.getSignatures("export function f(x: number,): void {}");
    expect(sigs.get("f")).toBe("export function f(x: number,): void");
  });

  it("captures generic with default value", () => {
    const sigs = checker.getSignatures("export function f<T extends string = 'foo'>(x: T): T { return x; }");
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("<T extends string = 'foo'>");
  });

  it("captures tuple type parameter", () => {
    const sigs = checker.getSignatures("export function f(x: [number, string]): void {}");
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("[number, string]");
  });

  it("captures BigInt default param value", () => {
    const sigs = checker.getSignatures("export function f(x: bigint = 100n): void {}");
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("x: bigint = 100n");
  });

  it("captures return type with optional chaining and union with undefined", () => {
    const sigs = checker.getSignatures("export function f(): Promise<X.Y | undefined> { return Promise.resolve(undefined); }");
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("Promise<X.Y | undefined>");
  });

  it("captures type alias for intersection", () => {
    const sigs = checker.getSignatures("export type F = A & B;");
    expect(sigs.get("F")).toBe("export type F = A & B;");
  });

  it("captures template literal type alias", () => {
    const sigs = checker.getSignatures("export type Greet<T extends string> = `hello ${T}`;");
    const text = sigs.get("Greet");
    expect(text).toBeDefined();
    expect(text).toContain("`hello ${T}`");
  });

  it("captures conditional type alias with infer keyword", () => {
    const sigs = checker.getSignatures("export type Unpack<T> = T extends Promise<infer U> ? U : T;");
    const text = sigs.get("Unpack");
    expect(text).toBeDefined();
    expect(text).toContain("infer U");
  });

  it("captures string literal union type alias", () => {
    const sigs = checker.getSignatures("export type Status = 'a' | 'b' | 'c';");
    expect(sigs.get("Status")).toBe("export type Status = 'a' | 'b' | 'c';");
  });

  it("captures recursive type alias", () => {
    const sigs = checker.getSignatures("export type T = { next: T | null };");
    expect(sigs.get("T")).toBe("export type T = { next: T | null };");
  });

  it("captures tuple rest type alias", () => {
    const sigs = checker.getSignatures("export type T = [number, ...string[]];");
    expect(sigs.get("T")).toBe("export type T = [number, ...string[]];");
  });

  it("captures deeply nested generic return type", () => {
    const sigs = checker.getSignatures("export function f(): Promise<Map<string, Array<number>>> { return Promise.resolve(new Map()); }");
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("Promise<Map<string, Array<number>>>");
  });

  it("captures interface with method signatures", () => {
    const src = "export interface I { foo(x: number): string; bar(): void; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("I")).toBe(src);
  });

  it("captures interface with call and construct signatures", () => {
    const src = "export interface I { (x: number): string; new (x: string): I; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("I")).toBe(src);
  });

  it("captures interface with overload method signatures", () => {
    const src = "export interface I { f(x: number): string; f(s: string): number; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("I")).toBe(src);
  });

  it("captures interface with abstract construct signature", () => {
    const src = "export interface I { abstract new (): I; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("I")).toBe(src);
  });

  it("captures interface extending multiple types", () => {
    const src = "export interface I extends A, B { foo(): void; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("I")).toBe(src);
  });

  it("captures interface with generic default", () => {
    const src = "export interface I<T extends string = 'x'> { foo(t: T): T; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("I")).toBe(src);
  });

  it("captures call signature type alias", () => {
    const sigs = checker.getSignatures("export type F = { (x: number): string };");
    expect(sigs.get("F")).toBe("export type F = { (x: number): string };");
  });

  it("captures overloaded interfaces keep full body across declarations", () => {
    const src = [
      "export interface I { a: string }",
      "export interface I { b: number }",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    const text = sigs.get("I");
    expect(text).toBeDefined();
    expect(text).toContain("interface I { a: string }");
    expect(text).toContain("interface I { b: number }");
  });

  it("captures export default class", () => {
    const sigs = checker.getSignatures("export default class Foo {}");
    const text = sigs.get("Foo");
    expect(text).toBeDefined();
    expect(text).toContain("class Foo");
  });

  it("captures export default function", () => {
    const sigs = checker.getSignatures("export default function bar() {}");
    const text = sigs.get("bar");
    expect(text).toBeDefined();
    expect(text).toContain("function bar()");
  });

  it("does not extract anonymous export default function", () => {
    const sigs = checker.getSignatures("export default function() {}");
    expect(sigs.size).toBe(0);
  });

  it("does not extract anonymous export default arrow", () => {
    const sigs = checker.getSignatures("export default () => 1;");
    expect(sigs.size).toBe(0);
  });

  it("captures multi-line decorator factory on class head", () => {
    const src = "@Component({\n  selector: 'app',\n  template: '<div></div>'\n})\nexport class C {}";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("C");
    expect(text).toBeDefined();
    expect(text).toContain("class C");
  });

  it("captures namespace containing class", () => {
    const src = "export namespace N { export class C {} }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("N")).toBe(src);
  });

  it("captures namespace containing interface", () => {
    const src = "export namespace N { export interface I {} }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("N")).toBe(src);
  });

  it("captures deeply nested namespaces as one entry", () => {
    const src = "export namespace A { export namespace B { export namespace C { export const x = 1; } } }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("A")).toBe(src);
  });

  it("captures declare namespace with nested namespace", () => {
    const src = "export declare namespace Outer { namespace Inner { const x: number; } }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("Outer")).toBe(src);
  });

  it("does not extract re-export of named types", () => {
    const sigs = checker.getSignatures("export type { Foo } from './foo';");
    expect(sigs.size).toBe(0);
  });

  it("does not extract re-export of multiple named types", () => {
    const sigs = checker.getSignatures("export type { A, B } from './m';");
    expect(sigs.size).toBe(0);
  });

  it("captures inline block comment in function parameter", () => {
    const sigs = checker.getSignatures("export function f(x: number /* hi */, y: string): void {}");
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("x: number");
    expect(text).toContain("y: string");
  });

  it("captures overload signatures separated by comments", () => {
    const src = [
      "// first overload",
      "export function f(x: number): void;",
      "// second overload",
      "export function f(x: string): void;",
      "export function f(x: number | string): void { return; }",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("function f(x: number): void");
    expect(text).toContain("function f(x: string): void");
  });

  it("captures function param containing line comment between params", () => {
    const src = "export function f(\n  // first param\n  x: number,\n  // second param\n  y: string\n): void {}";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("x: number");
    expect(text).toContain("y: string");
  });

  it("captures function param with multi-line generic constraint", () => {
    const src = "export function f<T extends {\n  a: number;\n  b: string;\n}>(x: T): T { return x; }";
    const sigs = checker.getSignatures(src);
    const text = sigs.get("f");
    expect(text).toBeDefined();
    expect(text).toContain("T extends");
  });

  it("captures type alias for function type with multi-line signature", () => {
    const sigs = checker.getSignatures("export type F = (\n  x: number,\n  y: string,\n) => void;");
    const text = sigs.get("F");
    expect(text).toBeDefined();
    expect(text).toContain("=> void");
  });

  it("captures enum with string literal values", () => {
    const sigs = checker.getSignatures("export enum E { A = 'a', B = 'b' }");
    expect(sigs.get("E")).toBe("export enum E { A = 'a', B = 'b' }");
  });

  it("captures ReturnType-style conditional with infer", () => {
    const sigs = checker.getSignatures("export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;");
    const text = sigs.get("ReturnType");
    expect(text).toBeDefined();
    expect(text).toContain("infer R");
  });

  // v1 limitations: per-method and per-property extraction inside classes is intentionally out of scope.
  it("v1 limitation: does not extract abstract method signatures inside class body", () => {
    const src = "export abstract class C { abstract foo(x: number): string; abstract bar(): void; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("C")).toBeDefined();
    expect(sigs.has("foo")).toBe(false);
    expect(sigs.has("bar")).toBe(false);
  });

  it("v1 limitation: does not extract class fields with type annotations", () => {
    const src = "export class C { x: number = 1; y: string = 'a'; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("x")).toBe(false);
    expect(sigs.has("y")).toBe(false);
  });

  it("v1 limitation: does not extract class fields with access modifiers", () => {
    const src = "export class C { readonly x: number = 1; private y: string = 'a'; protected z: boolean = true; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("x")).toBe(false);
    expect(sigs.has("y")).toBe(false);
    expect(sigs.has("z")).toBe(false);
  });

  it("v1 limitation: does not extract class fields with accessor keyword", () => {
    const src = "export class C { accessor x: number = 1; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("x")).toBe(false);
  });

  it("v1 limitation: does not extract static abstract class members", () => {
    const src = "export abstract class C { static abstract foo(): void; static abstract readonly x: number; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("foo")).toBe(false);
    expect(sigs.has("x")).toBe(false);
  });

  it("v1 limitation: does not extract class methods (private, public, static)", () => {
    const src = "export class C { public foo(): void {} private bar(): void {} static baz(): void {} }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("foo")).toBe(false);
    expect(sigs.has("bar")).toBe(false);
    expect(sigs.has("baz")).toBe(false);
  });

  it("v1 limitation: does not extract private constructor", () => {
    const src = "export class C { private constructor() {} }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("constructor")).toBe(false);
  });
});