import { describe, it, expect } from "vitest";
import { getChecker } from "../../../src/gates/checkers/registry.ts";
import "../../../src/gates/checkers/typescript.ts";

describe("TypeScript export checker", () => {
  const checker = getChecker("/file.ts")!;

  it("detects new export function", () => {
    const before = "";
    const after = "export function greet() {}";
    expect(checker.getNewExports(before, after)).toEqual(["greet"]);
  });

  it("detects new export const", () => {
    const before = "";
    const after = "export const VALUE = 42;";
    expect(checker.getNewExports(before, after)).toEqual(["VALUE"]);
  });

  it("detects new export class", () => {
    const before = "";
    const after = "export class MyService {}";
    expect(checker.getNewExports(before, after)).toEqual(["MyService"]);
  });

  it("detects new export type", () => {
    const before = "";
    const after = "export type Config = { port: number };";
    expect(checker.getNewExports(before, after)).toEqual(["Config"]);
  });

  it("detects new export interface", () => {
    const before = "";
    const after = "export interface Logger { log(msg: string): void; }";
    expect(checker.getNewExports(before, after)).toEqual(["Logger"]);
  });

  it("detects export default function with name", () => {
    const before = "";
    const after = "export default function main() {}";
    expect(checker.getNewExports(before, after)).toEqual(["main"]);
  });

  it("returns empty array when no new exports", () => {
    const code = "export function existing() {}\nexport const VAL = 1;";
    expect(checker.getNewExports(code, code)).toEqual([]);
  });

  it("handles export let", () => {
    const before = "";
    const after = "export let counter = 0;";
    expect(checker.getNewExports(before, after)).toEqual(["counter"]);
  });

  it("handles export var", () => {
    const before = "";
    const after = "export var legacy = true;";
    expect(checker.getNewExports(before, after)).toEqual(["legacy"]);
  });

  it("handles export enum", () => {
    const before = "";
    const after = "export enum Direction { Up, Down }";
    expect(checker.getNewExports(before, after)).toEqual(["Direction"]);
  });

  it("does not detect re-exports like export { Foo }", () => {
    const before = "";
    const after = 'export { Foo } from "./foo";';
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("detects multiple new exports", () => {
    const before = "export function existing() {}";
    const after =
      "export function existing() {}\nexport function newFn() {}\nexport const newConst = 1;";
    expect(checker.getNewExports(before, after)).toEqual([
      "newFn",
      "newConst",
    ]);
  });

  it("only reports exports that are genuinely new", () => {
    const before = "export function keep() {}\nexport const VALUE = 1;";
    const after =
      "export function keep() {}\nexport const VALUE = 1;\nexport type NewType = string;";
    expect(checker.getNewExports(before, after)).toEqual(["NewType"]);
  });
});
