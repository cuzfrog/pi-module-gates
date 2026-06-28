import { describe, it, expect } from "vitest";
import { getSignatureChecker } from "./registry.ts";
import "./rust.ts";

describe("Rust signature checker", () => {
  const checker = getSignatureChecker("/file.rs")!;

  it("captures function signature with params and return type", () => {
    const src = "fn add(a: i32, b: i32) -> i32 { a + b }";
    expect(checker.getSignatures(src).get("add")).toBe("fn add(a: i32, b: i32) -> i32");
  });

  it("captures pub function with visibility", () => {
    const src = "pub fn greet(name: &str) -> String { name.to_string() }";
    expect(checker.getSignatures(src).get("greet")).toBe("pub fn greet(name: &str) -> String");
  });

  it("captures pub(crate) visibility", () => {
    const src = "pub(crate) fn internal() -> bool { true }";
    expect(checker.getSignatures(src).get("internal")).toBe("pub(crate) fn internal() -> bool");
  });

  it("captures pub(super) visibility", () => {
    const src = "pub(super) fn visible_to_parent() {}";
    expect(checker.getSignatures(src).get("visible_to_parent")).toBe("pub(super) fn visible_to_parent()");
  });

  it("captures async function", () => {
    const src = "pub async fn fetch(url: &str) -> Result<String, Error> { Ok(url.into()) }";
    expect(checker.getSignatures(src).get("fetch")).toBe("pub async fn fetch(url: &str) -> Result<String, Error>");
  });

  it("captures const fn", () => {
    const src = "pub const fn square(x: u32) -> u32 { x * x }";
    expect(checker.getSignatures(src).get("square")).toBe("pub const fn square(x: u32) -> u32");
  });

  it("captures unsafe fn", () => {
    const src = "pub unsafe fn poke(addr: *mut u8) {}";
    expect(checker.getSignatures(src).get("poke")).toBe("pub unsafe fn poke(addr: *mut u8)");
  });

  it("captures generic function with where clause", () => {
    const src = "pub fn merge<T: Clone>(a: T, b: T) -> Vec<T> where T: Send { vec![a, b] }";
    expect(checker.getSignatures(src).get("merge")).toBe("pub fn merge<T: Clone>(a: T, b: T) -> Vec<T> where T: Send");
  });

  it("captures function with lifetime params", () => {
    const src = "pub fn longest<'a>(a: &'a str, b: &'a str) -> &'a str { if a.len() > b.len() { a } else { b } }";
    expect(checker.getSignatures(src).get("longest")).toBe("pub fn longest<'a>(a: &'a str, b: &'a str) -> &'a str");
  });

  it("captures trait declaration body in full", () => {
    const src = "pub trait Greet { fn hello(&self) -> &str; fn bye(&self) -> &str { \"bye\" } }";
    expect(checker.getSignatures(src).get("Greet")).toBe(src);
  });

  it("captures unsafe trait declaration body in full", () => {
    const src = "pub unsafe trait Send {}";
    expect(checker.getSignatures(src).get("Send")).toBe(src);
  });

  it("captures trait with generics and where bounds", () => {
    const src = "pub trait Iter<T> { fn next(&mut self) -> Option<T>; }";
    expect(checker.getSignatures(src).get("Iter")).toBe(src);
  });

  it("captures impl block as a single entry under impl trait for target", () => {
    const src = "impl Greet for Person { fn hello(&self) -> &str { &self.name } }";
    expect(checker.getSignatures(src).get("impl Greet for Person")).toBe(src);
  });

  it("captures struct head only and excludes body fields", () => {
    const src = "pub struct Point { x: i32, y: i32 }";
    expect(checker.getSignatures(src).get("Point")).toBe("pub struct Point");
  });

  it("captures tuple struct head only", () => {
    const src = "pub struct Pair(pub i32, i32);";
    expect(checker.getSignatures(src).get("Pair")).toBe("pub struct Pair(pub i32, i32)");
  });

  it("captures unit struct head only", () => {
    const src = "pub struct Marker;";
    expect(checker.getSignatures(src).get("Marker")).toBe("pub struct Marker");
  });

  it("captures generic struct head only", () => {
    const src = "pub struct Box<T> { value: T }";
    expect(checker.getSignatures(src).get("Box")).toBe("pub struct Box<T>");
  });

  it("captures enum head only and excludes variants", () => {
    const src = "pub enum Option<T> { None, Some(T) }";
    expect(checker.getSignatures(src).get("Option")).toBe("pub enum Option<T>");
  });

  it("captures C-like enum head only", () => {
    const src = "pub enum Status { Ok = 0, Err = 1 }";
    expect(checker.getSignatures(src).get("Status")).toBe("pub enum Status");
  });

  it("captures type alias RHS", () => {
    const src = "pub type Result<T> = std::result::Result<T, Error>;";
    expect(checker.getSignatures(src).get("Result")).toBe(src);
  });

  it("captures multiple signatures in one file", () => {
    const src = [
      "pub fn a() {}",
      "pub fn b() {}",
      "pub struct S { x: i32 }",
      "pub enum E { A, B }",
      "pub type T = i32;",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect([...sigs.keys()].sort()).toEqual(["E", "S", "T", "a", "b"].sort());
  });

  it("does not extract functions inside impl block as standalone", () => {
    const src = "impl Foo { pub fn bar() {} }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("bar")).toBe(false);
  });

  it("does not extract let bindings as signatures", () => {
    const src = "pub const X: i32 = 42;";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("X")).toBe(false);
  });

  it("ignores line comments when matching fn header", () => {
    const src = "// hello\npub fn f() {}";
    expect(checker.getSignatures(src).get("f")).toBe("pub fn f()");
  });

  it("captures function with const generics", () => {
    const src = "pub fn foo<const N: usize>(arr: [u8; N]) -> [u8; N] { arr }";
    expect(checker.getSignatures(src).get("foo")).toBe(
      "pub fn foo<const N: usize>(arr: [u8; N]) -> [u8; N]",
    );
  });

  it("captures function with multiple const generics", () => {
    const src = "pub fn foo<const N: usize, const M: usize>(arr: [u8; N]) -> [u8; M] { [0; M] }";
    expect(checker.getSignatures(src).get("foo")).toBe(
      "pub fn foo<const N: usize, const M: usize>(arr: [u8; N]) -> [u8; M]",
    );
  });

  it("captures function with multiple where-clause bounds", () => {
    const src = "pub fn cmp<T>(a: T, b: T) -> bool where T: PartialEq + Ord + Send + Sync { a == b }";
    expect(checker.getSignatures(src).get("cmp")).toBe(
      "pub fn cmp<T>(a: T, b: T) -> bool where T: PartialEq + Ord + Send + Sync",
    );
  });

  it("captures trait with associated types", () => {
    const src = "pub trait IntoIterator { type Item; type IntoIter: Iterator<Item = Self::Item>; fn into_iter(self) -> Self::IntoIter; }";
    expect(checker.getSignatures(src).get("IntoIterator")).toBe(src);
  });

  it("captures trait with associated constants", () => {
    const src = "pub trait Consts { const MAX: usize; const MIN: i32 = -1; }";
    expect(checker.getSignatures(src).get("Consts")).toBe(src);
  });

  it("captures trait with super-trait bounds", () => {
    const src = "pub trait Foo: Bar + Baz { fn f(); }";
    expect(checker.getSignatures(src).get("Foo")).toBe(src);
  });

  it("captures trait with default method implementations", () => {
    const src = "pub trait Greet { fn hello(&self) -> &str { \"hi\" } fn bye(&self) -> &str; }";
    expect(checker.getSignatures(src).get("Greet")).toBe(src);
  });

  it("captures trait with async method", () => {
    const src = "pub trait Async { async fn run(&self); }";
    expect(checker.getSignatures(src).get("Async")).toBe(src);
  });

  it("captures struct with #[derive] attribute", () => {
    const src = "#[derive(Debug, Clone)]\npub struct Point { x: i32, y: i32 }";
    expect(checker.getSignatures(src).get("Point")).toBe(
      "#[derive(Debug, Clone)]\npub struct Point",
    );
  });

  it("captures pub fn with /// doc comment above", () => {
    const src = "/// greet a person\npub fn greet(name: &str) -> String { name.to_string() }";
    expect(checker.getSignatures(src).get("greet")).toBe(
      "/// greet a person\npub fn greet(name: &str) -> String",
    );
  });

  it("captures pub fn with //! inner doc comment above", () => {
    const src = "//! internal docs\npub fn greet() {}";
    expect(checker.getSignatures(src).get("greet")).toBe(
      "//! internal docs\npub fn greet()",
    );
  });

  it("captures pub fn with #[doc = \"...\"] attribute", () => {
    const src = "#[doc = \"greet\"]\npub fn greet() {}";
    expect(checker.getSignatures(src).get("greet")).toBe(
      "#[doc = \"greet\"]\npub fn greet()",
    );
  });

  it("captures pub fn with doc and attribute", () => {
    const src = "/// greet\n#[inline]\npub fn greet() {}";
    expect(checker.getSignatures(src).get("greet")).toBe(
      "/// greet\n#[inline]\npub fn greet()",
    );
  });

  it("captures function returning impl Trait", () => {
    const src = "pub fn make_iter() -> impl Iterator<Item = i32> { 0..10 }";
    expect(checker.getSignatures(src).get("make_iter")).toBe(
      "pub fn make_iter() -> impl Iterator<Item = i32>",
    );
  });

  it("captures function returning dyn Trait", () => {
    const src = 'pub fn make() -> Box<dyn std::fmt::Display> { Box::new(42) }';
    expect(checker.getSignatures(src).get("make")).toBe(
      'pub fn make() -> Box<dyn std::fmt::Display>',
    );
  });

  it("captures function with impl Trait in argument position", () => {
    const src = "pub fn use_iter(it: impl Iterator<Item = i32>) -> i32 { 0 }";
    expect(checker.getSignatures(src).get("use_iter")).toBe(
      "pub fn use_iter(it: impl Iterator<Item = i32>) -> i32",
    );
  });

  it("captures function with fn pointer argument", () => {
    const src = "pub fn takes_fn(f: fn(i32) -> i32) -> i32 { f(0) }";
    expect(checker.getSignatures(src).get("takes_fn")).toBe(
      "pub fn takes_fn(f: fn(i32) -> i32) -> i32",
    );
  });

  it("does not extract impl methods as standalone signatures (v1 limitation)", () => {
    const src = "impl Foo { pub fn get(&self) -> i32 { 0 } pub fn new() -> Self { Foo } }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("get")).toBe(false);
    expect(sigs.has("new")).toBe(false);
  });

  it("captures trait with associated-type bounds", () => {
    const src = "pub trait Iter { type Item: Clone + Send; fn next(&mut self) -> Option<Self::Item>; }";
    expect(checker.getSignatures(src).get("Iter")).toBe(src);
  });

  it("captures function with HRTB (higher-ranked trait bounds)", () => {
    const src = "pub fn apply<F>(f: F) where for<'a> F: Fn(&'a i32);";
    expect(checker.getSignatures(src).get("apply")).toBe(
      "pub fn apply<F>(f: F) where for<'a> F: Fn(&'a i32)",
    );
  });

  it("captures function with module-level attribute", () => {
    const src = "#![allow(dead_code)]\npub fn f() {}";
    expect(checker.getSignatures(src).get("f")).toBe(
      "#![allow(dead_code)]\npub fn f()",
    );
  });

  it("captures extern C ABI function", () => {
    const src = 'pub extern "C" fn c_abi(x: i32) -> i32 { x }';
    expect(checker.getSignatures(src).get("c_abi")).toBe(
      'pub extern "C" fn c_abi(x: i32) -> i32',
    );
  });

  it("captures struct with const generic and default value", () => {
    const src = "pub struct Buffer<const SIZE: usize = 1024> { data: [u8; SIZE] }";
    expect(checker.getSignatures(src).get("Buffer")).toBe(
      "pub struct Buffer<const SIZE: usize = 1024>",
    );
  });

  it("captures struct with const generic and expression default", () => {
    const src = "pub struct S<const N: usize = { 1 + 1 }> { x: [u8; N] }";
    expect(checker.getSignatures(src).get("S")).toBe(
      "pub struct S<const N: usize = { 1 + 1 }>",
    );
  });

  it("captures pub(self) visibility", () => {
    const src = "pub(self) fn private() {}";
    expect(checker.getSignatures(src).get("private")).toBe("pub(self) fn private()");
  });

  it("captures pub(in path) visibility", () => {
    const src = "pub(in crate::foo) fn private() {}";
    expect(checker.getSignatures(src).get("private")).toBe(
      "pub(in crate::foo) fn private()",
    );
  });

  it("captures const trait", () => {
    const src = "pub const trait ConstTrait { fn f(); }";
    expect(checker.getSignatures(src).get("ConstTrait")).toBe(src);
  });

  it("captures doc on struct, trait, enum, type alias", () => {
    const cases: ReadonlyArray<{ key: string; src: string; expected: string }> = [
      { key: "Point", src: "/// A point.\npub struct Point { x: i32, y: i32 }", expected: "/// A point.\npub struct Point" },
      { key: "Greet", src: "/// Greet trait\npub trait Greet { fn hi(&self); }", expected: "/// Greet trait\npub trait Greet { fn hi(&self); }" },
      { key: "Color", src: "/// Color\npub enum Color { Red, Green, Blue }", expected: "/// Color\npub enum Color" },
      { key: "Result", src: "/// Result\npub type Result<T> = std::result::Result<T, Error>;", expected: "/// Result\npub type Result<T> = std::result::Result<T, Error>;" },
    ];
    for (const c of cases) {
      expect(checker.getSignatures(c.src).get(c.key)).toBe(c.expected);
    }
  });

  it("does not extract macro_rules! as signature", () => {
    const src = "macro_rules! my_macro { ($x:expr) => { $x }; }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("my_macro")).toBe(false);
  });

  it("captures function with return type array of fixed size", () => {
    const src = "pub fn f() -> [u8; 2] { [0, 0] }";
    expect(checker.getSignatures(src).get("f")).toBe("pub fn f() -> [u8; 2]");
  });

  it("captures struct with pub fields (regression: head only)", () => {
    const src = "pub struct S { pub x: i32, y: i32 }";
    expect(checker.getSignatures(src).get("S")).toBe("pub struct S");
  });
});
