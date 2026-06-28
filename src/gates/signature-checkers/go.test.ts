import { describe, it, expect } from "vitest";
import { getSignatureChecker } from "./registry.ts";
import "./go.ts";

describe("Go signature checker", () => {
  const checker = getSignatureChecker("/file.go")!;

  it("captures simple function with single return", () => {
    const src = "func Add(a, b int) int { return a + b }";
    expect(checker.getSignatures(src).get("Add")).toBe("func Add(a, b int) int");
  });

  it("captures function with no params and no return", () => {
    const src = "func Noop() {}";
    expect(checker.getSignatures(src).get("Noop")).toBe("func Noop()");
  });

  it("captures function with multi-return", () => {
    const src = "func Swap(a, b string) (string, string) { return b, a }";
    expect(checker.getSignatures(src).get("Swap")).toBe("func Swap(a, b string) (string, string)");
  });

  it("captures function with named returns", () => {
    const src = "func Copy(src, dst string) (n int, err error) { return }";
    expect(checker.getSignatures(src).get("Copy")).toBe("func Copy(src, dst string) (n int, err error)");
  });

  it("captures method with receiver", () => {
    const src = "func (s *Server) Start(port int) error { return nil }";
    expect(checker.getSignatures(src).get("Start")).toBe("func (s *Server) Start(port int) error");
  });

  it("captures method with value receiver", () => {
    const src = "func (s Server) Name() string { return s.name }";
    expect(checker.getSignatures(src).get("Name")).toBe("func (s Server) Name() string");
  });

  it("captures generic function", () => {
    const src = "func Map[T, U any](s []T, f func(T) U) []U { return nil }";
    expect(checker.getSignatures(src).get("Map")).toBe("func Map[T, U any](s []T, f func(T) U) []U");
  });

  it("captures generic method", () => {
    const src = "func (b *Box[T]) Get() T { return b.value }";
    expect(checker.getSignatures(src).get("Get")).toBe("func (b *Box[T]) Get() T");
  });

  it("captures variadic function", () => {
    const src = "func Log(msgs ...string) { }";
    expect(checker.getSignatures(src).get("Log")).toBe("func Log(msgs ...string)");
  });

  it("captures struct type declaration head only", () => {
    const src = "type Point struct { X int; Y int }";
    expect(checker.getSignatures(src).get("Point")).toBe("type Point struct");
  });

  it("captures generic struct type declaration head", () => {
    const src = "type Box[T any] struct { Value T }";
    const text = checker.getSignatures(src).get("Box");
    expect(text).toBeDefined();
    expect(text).toContain("type Box");
    expect(text).toContain("[T any]");
    expect(text).not.toContain("Value T");
  });

  it("captures interface type declaration body in full", () => {
    const src = "type Reader interface { Read(p []byte) (n int, err error) }";
    expect(checker.getSignatures(src).get("Reader")).toBe(src);
  });

  it("captures generic interface type declaration body in full", () => {
    const src = "type Container[T any] interface { Add(T); Get() T }";
    expect(checker.getSignatures(src).get("Container")).toBe(src);
  });

  it("captures type alias RHS up to newline", () => {
    const src = "type Handler = func() error";
    expect(checker.getSignatures(src).get("Handler")).toBe(src);
  });

  it("captures named type alias (distinct from struct)", () => {
    const src = "type UserID int";
    expect(checker.getSignatures(src).get("UserID")).toBe(src);
  });

  it("captures multiple declarations in one file", () => {
    const src = [
      "func A() {}",
      "func B() int { return 1 }",
      "type S struct { X int }",
      "type I interface { Foo() }",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect([...sigs.keys()].sort()).toEqual(["A", "B", "I", "S"].sort());
  });

  it("does not extract function literals inside other functions", () => {
    const src = "func Outer() { inner := func() int { return 1 } }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("Outer")).toBe(true);
  });

  it("ignores line comments when matching declarations", () => {
    const src = "// hello\nfunc Greet() string { return \"hi\" }";
    expect(checker.getSignatures(src).get("Greet")).toBe("func Greet() string");
  });

  it("captures both pointer and value receivers for the same type", () => {
    const src = [
      "type S struct{}",
      "func (s *S) P() {}",
      "func (s S) V() {}",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect(sigs.get("P")).toBe("func (s *S) P()");
    expect(sigs.get("V")).toBe("func (s S) V()");
  });

  it("captures method with multiple type parameters and constraints", () => {
    const src = "func (c *C[T, U, V]) M(x T, y U) V { return *new(V) }";
    expect(checker.getSignatures(src).get("M")).toBe(
      "func (c *C[T, U, V]) M(x T, y U) V",
    );
  });

  it("captures function with same-type parameter grouping", () => {
    const src = "func f(a, b int) {}";
    expect(checker.getSignatures(src).get("f")).toBe("func f(a, b int)");
  });

  it("captures function with mixed parameter types", () => {
    const src = "func f(a int, b string, c []float64) {}";
    expect(checker.getSignatures(src).get("f")).toBe(
      "func f(a int, b string, c []float64)",
    );
  });

  it("captures interface that embeds other interfaces", () => {
    const src = "type Foo interface { I1; I2; Foo() }";
    expect(checker.getSignatures(src).get("Foo")).toBe(src);
  });

  it("captures type with multiple generic type parameters", () => {
    const src = "type Pair[K comparable, V any] struct { K K; V V }";
    expect(checker.getSignatures(src).get("Pair")).toBe(
      "type Pair[K comparable, V any] struct",
    );
  });

  it("captures type constraint with ~T underlying type", () => {
    const src = "type Integer interface { ~int | ~int32 | ~int64 }";
    expect(checker.getSignatures(src).get("Integer")).toBe(src);
  });

  it("captures method using type parameter from its receiver", () => {
    const src = "func (l *List[T]) Push(v T) { l.items = append(l.items, v) }";
    expect(checker.getSignatures(src).get("Push")).toBe(
      "func (l *List[T]) Push(v T)",
    );
  });

  it("captures method returning a function type", () => {
    const src = "func (s *S) Get() func(int) bool { return nil }";
    expect(checker.getSignatures(src).get("Get")).toBe(
      "func (s *S) Get() func(int) bool",
    );
  });

  it("captures method returning a channel", () => {
    const src = "func (s *S) Stream() chan int { return nil }";
    expect(checker.getSignatures(src).get("Stream")).toBe(
      "func (s *S) Stream() chan int",
    );
  });

  it("captures signature of a function with defer/panic/recover in body", () => {
    const src = [
      "func Risky() (err error) {",
      "  defer func() { recover() }()",
      "  panic(\"oops\")",
      "}",
    ].join("\n");
    expect(checker.getSignatures(src).get("Risky")).toBe(
      "func Risky() (err error)",
    );
  });

  it("captures struct with embedded (anonymous) fields", () => {
    const src = "type Derived struct { Base; Y int }";
    expect(checker.getSignatures(src).get("Derived")).toBe(
      "type Derived struct",
    );
  });

  it("captures struct head even when struct body contains a tag", () => {
    const src = "type S struct { Name string `json:\"name\"` }";
    expect(checker.getSignatures(src).get("S")).toBe("type S struct");
  });

  it("captures function returning *T vs T distinctly", () => {
    const src = [
      "type T struct{}",
      "func A() T { return T{} }",
      "func B() *T { return &T{} }",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect(sigs.get("A")).toBe("func A() T");
    expect(sigs.get("B")).toBe("func B() *T");
  });

  it("captures method with channel parameter", () => {
    const src = "func (s *S) Send(ch chan int) {}";
    expect(checker.getSignatures(src).get("Send")).toBe(
      "func (s *S) Send(ch chan int)",
    );
  });

  it("captures function with map parameter", () => {
    const src = "func f(m map[string]int) {}";
    expect(checker.getSignatures(src).get("f")).toBe("func f(m map[string]int)");
  });

  it("captures function with anonymous struct parameter", () => {
    const src = "func f(p struct{ X int }) {}";
    expect(checker.getSignatures(src).get("f")).toBe("func f(p struct{ X int })");
  });

  it("captures type alias of an interface", () => {
    const src = "type Reader = interface { Read(p []byte) (n int, err error) }";
    expect(checker.getSignatures(src).get("Reader")).toBe(src);
  });

  it("captures type alias of a channel", () => {
    const src = "type Ch = chan int";
    expect(checker.getSignatures(src).get("Ch")).toBe(src);
  });

  it("captures function preceded by a build constraint comment", () => {
    const src = "//go:build linux\nfunc f() {}";
    expect(checker.getSignatures(src).get("f")).toBe("func f()");
  });

  it("captures head only for multi-line struct", () => {
    const src = ["type S struct {", "  A int", "  B string", "}"].join("\n");
    expect(checker.getSignatures(src).get("S")).toBe("type S struct");
  });

  it("captures body in full for multi-line generic interface with constraints", () => {
    const src = [
      "type Ordered[T constraints.Ordered] interface {",
      "  Less(other T) bool",
      "}",
    ].join("\n");
    expect(checker.getSignatures(src).get("Ordered")).toBe(src);
  });

  it("does not capture type beyond its declaration line", () => {
    const src = [
      "type Integer interface { ~int | ~int32 | ~int64 }",
      "type MyInt int",
      "func Add[T Integer](a, b T) T { return a + b }",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect(sigs.get("MyInt")).toBe("type MyInt int");
    expect(sigs.get("Add")).toBe("func Add[T Integer](a, b T) T");
  });

  it("captures generic interface with type constraints and method set", () => {
    const src = "type Container[T any] interface { Add(T); Get() T }";
    expect(checker.getSignatures(src).get("Container")).toBe(src);
  });

  it("does not capture names inside const or var blocks", () => {
    const src = [
      "const (",
      "  A = 1",
      "  B = 2",
      ")",
      "var (",
      "  X = 1",
      "  Y = 2",
      ")",
      "func F() {}",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect([...sigs.keys()]).toEqual(["F"]);
  });

  it("does not extract names from function literals assigned to vars", () => {
    const src = "var f = func(x int) int { return x }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("f")).toBe(false);
  });
});
