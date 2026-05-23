import { describe, it, expect } from "vitest";
import { getChecker } from "../../../src/gates/checkers/registry.ts";
import "../../../src/gates/checkers/rust.ts";

describe("Rust export checker", () => {
  const checker = getChecker("/file.rs")!;

  it("detects new pub fn", () => {
    const before = "";
    const after = "pub fn hello() {}";
    expect(checker.getNewExports(before, after)).toEqual(["hello"]);
  });

  it("detects new pub struct", () => {
    const before = "";
    const after = "pub struct Config {}";
    expect(checker.getNewExports(before, after)).toEqual(["Config"]);
  });

  it("detects new pub enum", () => {
    const before = "";
    const after = "pub enum Status { Active, Inactive }";
    expect(checker.getNewExports(before, after)).toEqual(["Status"]);
  });

  it("detects new pub trait", () => {
    const before = "";
    const after = "pub trait Drawable { fn draw(&self); }";
    expect(checker.getNewExports(before, after)).toEqual(["Drawable"]);
  });

  it("detects new pub type", () => {
    const before = "";
    const after = "pub type Result<T> = std::result::Result<T, Error>;";
    expect(checker.getNewExports(before, after)).toEqual(["Result"]);
  });

  it("detects new pub const", () => {
    const before = "";
    const after = "pub const MAX: u32 = 100;";
    expect(checker.getNewExports(before, after)).toEqual(["MAX"]);
  });

  it("detects new pub mod", () => {
    const before = "";
    const after = "pub mod utils;";
    expect(checker.getNewExports(before, after)).toEqual(["utils"]);
  });

  it("handles pub(crate) modifier", () => {
    const before = "";
    const after = "pub(crate) fn internal_fn() {}";
    expect(checker.getNewExports(before, after)).toEqual(["internal_fn"]);
  });

  it("handles pub(super) modifier", () => {
    const before = "";
    const after = "pub(super) struct ParentVisible {}";
    expect(checker.getNewExports(before, after)).toEqual(["ParentVisible"]);
  });

  it("returns empty when no new exports", () => {
    const code = "pub fn existing() {}\npub struct Config {}";
    expect(checker.getNewExports(code, code)).toEqual([]);
  });

  it("detects multiple new exports", () => {
    const before = "pub fn existing() {}";
    const after =
      "pub fn existing() {}\npub fn new_fn() {}\npub struct NewStruct {}";
    expect(checker.getNewExports(before, after)).toEqual([
      "new_fn",
      "NewStruct",
    ]);
  });

  it("does not detect private fn", () => {
    const before = "";
    const after = "fn private_helper() {}";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });
});
