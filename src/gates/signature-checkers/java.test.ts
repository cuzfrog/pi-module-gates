import { describe, it, expect } from "vitest";
import { getSignatureChecker } from "./registry.ts";
import "./java.ts";

describe("Java signature checker", () => {
  const checker = getSignatureChecker("/File.java")!;

  it("captures method signature with return type and params", () => {
    const src = "public int add(int a, int b) { return a + b; }";
    expect(checker.getSignatures(src).get("add")).toBe("public int add(int a, int b)");
  });

  it("captures public static method", () => {
    const src = "public static <T> List<T> emptyList() { return List.of(); }";
    const text = checker.getSignatures(src).get("emptyList");
    expect(text).toBeDefined();
    expect(text).toContain("public static");
    expect(text).toContain("emptyList()");
  });

  it("captures method with throws clause", () => {
    const src = "public void read() throws IOException { }";
    expect(checker.getSignatures(src).get("read")).toBe("public void read() throws IOException");
  });

  it("captures abstract method signature", () => {
    const src = "public abstract void execute();";
    expect(checker.getSignatures(src).get("execute")).toBe("public abstract void execute()");
  });

  it("captures class head only and excludes body", () => {
    const src = "public class Point extends Shape implements Drawable { int x; }";
    const text = checker.getSignatures(src).get("Point");
    expect(text).toBeDefined();
    expect(text).toContain("class Point");
    expect(text).toContain("extends Shape");
    expect(text).toContain("implements Drawable");
    expect(text).not.toContain("int x");
  });

  it("captures generic class head", () => {
    const src = "public class Box<T extends Comparable<T>> { T value; }";
    const text = checker.getSignatures(src).get("Box");
    expect(text).toBeDefined();
    expect(text).toContain("class Box");
    expect(text).toContain("<T extends Comparable<T>>");
  });

  it("captures interface body in full", () => {
    const src = "public interface Listener { void onEvent(); void onClose(); }";
    expect(checker.getSignatures(src).get("Listener")).toBe(src);
  });

  it("captures generic interface body in full", () => {
    const src = "public interface Comparable<T> { int compareTo(T o); }";
    expect(checker.getSignatures(src).get("Comparable")).toBe(src);
  });

  it("captures enum head only", () => {
    const src = "public enum Color { RED, GREEN, BLUE }";
    const text = checker.getSignatures(src).get("Color");
    expect(text).toBe("public enum Color");
  });

  it("captures record head with component list", () => {
    const src = "public record Point(int x, int y) { }";
    const text = checker.getSignatures(src).get("Point");
    expect(text).toBeDefined();
    expect(text).toContain("record Point");
    expect(text).toContain("(int x, int y)");
  });

  it("captures annotation type declaration body in full", () => {
    const src = "public @interface MyAnno { String value(); }";
    expect(checker.getSignatures(src).get("MyAnno")).toBe(src);
  });

  it("does not extract methods inside class bodies as top-level entries", () => {
    const src = "class C { void inner() {} }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("inner")).toBe(false);
  });

  it("captures top-level method alongside class declaration", () => {
    const src = [
      "class Helper { void inner() {} }",
      "public void freeFunction() {}",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect(sigs.has("Helper")).toBe(true);
    expect(sigs.has("freeFunction")).toBe(true);
    expect(sigs.has("inner")).toBe(false);
  });

  it("captures final method", () => {
    const src = "public final String toString() { return \"x\"; }";
    expect(checker.getSignatures(src).get("toString")).toBe("public final String toString()");
  });

  it("captures protected static synchronized method", () => {
    const src = "protected static synchronized void tick() { }";
    expect(checker.getSignatures(src).get("tick")).toBe("protected static synchronized void tick()");
  });

  it("captures default method in interface", () => {
    const src = "interface I { default void hello() { System.out.println(\"hi\"); } }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("I")).toBe(true);
  });

  it("captures varargs method", () => {
    const src = "public void log(String... messages) { }";
    expect(checker.getSignatures(src).get("log")).toBe("public void log(String... messages)");
  });

  it("handles comments inside parameter list", () => {
    const src = "void f(int a /* primary */, int b) {}";
    expect(checker.getSignatures(src).get("f")).toBe("void f(int a /* primary */, int b)");
  });

  it("captures sealed class with permits clause", () => {
    const src = "public sealed class Shape permits Circle, Square {}";
    const text = checker.getSignatures(src).get("Shape");
    expect(text).toBeDefined();
    expect(text).toContain("sealed class Shape");
    expect(text).toContain("permits Circle, Square");
  });

  it("captures non-sealed class", () => {
    const src = "public non-sealed class Shape extends Circle { }";
    const text = checker.getSignatures(src).get("Shape");
    expect(text).toBeDefined();
    expect(text).toContain("non-sealed class Shape");
    expect(text).toContain("extends Circle");
  });

  it("captures sealed interface with permits clause", () => {
    const src = "public sealed interface Expr permits Add, Sub {}";
    const text = checker.getSignatures(src).get("Expr");
    expect(text).toBeDefined();
    expect(text).toContain("sealed interface Expr");
    expect(text).toContain("permits Add, Sub");
  });

  it("captures sealed record with permits clause", () => {
    const src = "public sealed record Point(int x, int y) permits ColoredPoint { }";
    const text = checker.getSignatures(src).get("Point");
    expect(text).toBeDefined();
    expect(text).toContain("sealed record Point");
    expect(text).toContain("permits ColoredPoint");
  });

  it("does not double-capture record declaration as a method", () => {
    const src = "public final record Point(int x, int y) { }";
    const sigs = checker.getSignatures(src);
    const entry = sigs.get("Point");
    expect(entry).toBe("public final record Point(int x, int y)");
    expect(entry).not.toContain("\n");
  });

  it("captures method with multi-bound generic type parameter", () => {
    const src = "public <T extends Comparable<T> & Cloneable> List<T[]> sort(T[] items) { return null; }";
    const text = checker.getSignatures(src).get("sort");
    expect(text).toBe("public <T extends Comparable<T> & Cloneable> List<T[]> sort(T[] items)");
  });

  it("captures method returning intersection type", () => {
    const src = "public Comparable<T> & Serializable foo() { return null; }";
    expect(checker.getSignatures(src).get("foo")).toBe("public Comparable<T> & Serializable foo()");
  });

  it("captures method overloading as concatenated entries under same name", () => {
    const src = [
      "public int add(int a) { return a; }",
      "public int add(int a, int b) { return a + b; }",
    ].join("\n");
    const text = checker.getSignatures(src).get("add");
    expect(text).toBeDefined();
    expect(text).toContain("public int add(int a)");
    expect(text).toContain("public int add(int a, int b)");
  });

  it("does not extract inner class declaration as a separate top-level entry", () => {
    const src = "public class Outer { public static class Inner { } }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("Outer")).toBe(true);
    expect(sigs.has("Inner")).toBe(false);
  });
});
