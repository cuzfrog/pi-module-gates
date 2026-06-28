import { describe, it, expect } from "vitest";
import { getSignatureChecker } from "./registry.ts";
import "./kotlin.ts";

describe("Kotlin signature checker", () => {
  const checker = getSignatureChecker("/File.kt")!;

  it("captures top-level function with return type", () => {
    const src = "fun add(a: Int, b: Int): Int = a + b";
    expect(checker.getSignatures(src).get("add")).toBe("fun add(a: Int, b: Int): Int");
  });

  it("captures function with default parameter", () => {
    const src = "fun greet(name: String = \"world\"): String = \"hi $name\"";
    expect(checker.getSignatures(src).get("greet")).toBe("fun greet(name: String = \"world\"): String");
  });

  it("captures function with generic param", () => {
    const src = "fun <T> identity(value: T): T = value";
    expect(checker.getSignatures(src).get("identity")).toBe("fun <T> identity(value: T): T");
  });

  it("captures suspend function", () => {
    const src = "suspend fun fetch(url: String): String = \"\"";
    expect(checker.getSignatures(src).get("fetch")).toBe("suspend fun fetch(url: String): String");
  });

  it("captures inline function", () => {
    const src = "inline fun <T> runIf(condition: Boolean, block: () -> T): T? = null";
    const text = checker.getSignatures(src).get("runIf");
    expect(text).toBeDefined();
    expect(text).toContain("inline fun");
    expect(text).toContain("<T>");
    expect(text).toContain("runIf");
  });

  it("captures private function with modifiers", () => {
    const src = "private fun helper(): Unit {}";
    expect(checker.getSignatures(src).get("helper")).toBe("private fun helper(): Unit");
  });

  it("captures function with no return type (Unit)", () => {
    const src = "fun tick() {}";
    expect(checker.getSignatures(src).get("tick")).toBe("fun tick()");
  });

  it("captures class head with primary constructor", () => {
    const src = "class User(val name: String, val age: Int) { fun greet() {} }";
    const text = checker.getSignatures(src).get("User");
    expect(text).toBeDefined();
    expect(text).toContain("class User");
    expect(text).toContain("(val name: String, val age: Int)");
    expect(text).not.toContain("fun greet");
  });

  it("captures generic class head", () => {
    const src = "class Box<T : Comparable<T>>(val value: T) {}";
    const text = checker.getSignatures(src).get("Box");
    expect(text).toBeDefined();
    expect(text).toContain("class Box");
    expect(text).toContain("<T : Comparable<T>>");
  });

  it("captures data class head", () => {
    const src = "data class Point(val x: Int, val y: Int)";
    const text = checker.getSignatures(src).get("Point");
    expect(text).toBe("data class Point(val x: Int, val y: Int)");
  });

  it("captures sealed class head", () => {
    const src = "sealed class Result<out T> { class Ok<T>(val v: T) : Result<T>() }";
    const text = checker.getSignatures(src).get("Result");
    expect(text).toBe("sealed class Result<out T>");
  });

  it("captures enum class head", () => {
    const src = "enum class Color { RED, GREEN, BLUE }";
    const text = checker.getSignatures(src).get("Color");
    expect(text).toBe("enum class Color");
  });

  it("captures interface head", () => {
    const src = "interface Greeter { fun greet(name: String): String }";
    const text = checker.getSignatures(src).get("Greeter");
    expect(text).toBe("interface Greeter");
  });

  it("captures generic interface head", () => {
    const src = "interface Container<T> { fun add(item: T); fun get(): T }";
    const text = checker.getSignatures(src).get("Container");
    expect(text).toBe("interface Container<T>");
  });

  it("captures fun interface head", () => {
    const src = "fun interface Producer<T> { fun produce(): T }";
    const text = checker.getSignatures(src).get("Producer");
    expect(text).toBeDefined();
    expect(text).toContain("fun interface Producer");
  });

  it("captures object declaration head", () => {
    const src = "object Singleton { fun callMe() {} }";
    const text = checker.getSignatures(src).get("Singleton");
    expect(text).toBe("object Singleton");
  });

  it("captures companion object head", () => {
    const src = "companion object { const val TAG = \"x\" }";
    const text = checker.getSignatures(src).get("Companion");
    expect(text).toBeDefined();
    expect(text).toContain("object");
  });

  it("captures typealias RHS", () => {
    const src = "typealias StringMap = Map<String, String>";
    expect(checker.getSignatures(src).get("StringMap")).toBe("typealias StringMap = Map<String, String>");
  });

  it("captures generic typealias", () => {
    const src = "typealias Handler<T> = (T) -> Unit";
    expect(checker.getSignatures(src).get("Handler")).toBe("typealias Handler<T> = (T) -> Unit");
  });

  it("does not extract member functions inside a class", () => {
    const src = "class C { fun inner() {} }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("inner")).toBe(false);
  });

  it("captures top-level functions alongside a class", () => {
    const src = [
      "class Box { fun inner() {} }",
      "fun top(): Int = 1",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect(sigs.has("Box")).toBe(true);
    expect(sigs.has("top")).toBe(true);
    expect(sigs.has("inner")).toBe(false);
  });

  it("captures extension function", () => {
    const src = "fun String.shout(): String = uppercase()";
    expect(checker.getSignatures(src).get("shout")).toBe("fun String.shout(): String");
  });

  it("captures function with vararg param", () => {
    const src = "fun f(vararg args: String) {}";
    expect(checker.getSignatures(src).get("f")).toBe("fun f(vararg args: String)");
  });

  it("captures extension function with vararg param", () => {
    const src = "fun Int.sum(vararg others: Int): Int = others.sum() + this";
    expect(checker.getSignatures(src).get("sum")).toBe("fun Int.sum(vararg others: Int): Int");
  });

  it("captures function with multiple default params", () => {
    const src = "fun f(a: Int = 1, b: String = \"x\", c: Boolean = true) {}";
    expect(checker.getSignatures(src).get("f")).toBe("fun f(a: Int = 1, b: String = \"x\", c: Boolean = true)");
  });

  it("captures function returning nullable type", () => {
    const src = "fun f(): String? = null";
    expect(checker.getSignatures(src).get("f")).toBe("fun f(): String?");
  });

  it("captures function with explicit Unit return", () => {
    const src = "fun f(): Unit {}";
    expect(checker.getSignatures(src).get("f")).toBe("fun f(): Unit");
  });

  it("captures function with implicit Unit return", () => {
    const src = "fun f() {}";
    expect(checker.getSignatures(src).get("f")).toBe("fun f()");
  });

  it("captures function with reified type param", () => {
    const src = "inline fun <reified T> f() = T::class";
    expect(checker.getSignatures(src).get("f")).toBe("inline fun <reified T> f()");
  });

  it("captures function with reified type param and bound", () => {
    const src = "inline fun <reified T : Enum<T>> f() = T::class";
    expect(checker.getSignatures(src).get("f")).toBe("inline fun <reified T : Enum<T>> f()");
  });

  it("captures function with complex generic bound", () => {
    const src = "fun <T : Comparable<T>> f() {}";
    expect(checker.getSignatures(src).get("f")).toBe("fun <T : Comparable<T>> f()");
  });

  it("captures function with multiple generic bounds", () => {
    const src = "fun <K : Any, V : Comparable<V>> f() {}";
    expect(checker.getSignatures(src).get("f")).toBe("fun <K : Any, V : Comparable<V>> f()");
  });

  it("captures function with where clause bounds", () => {
    const src = "fun <T> f() where T : Comparable<T> = null";
    expect(checker.getSignatures(src).get("f")).toBe("fun <T> f() where T : Comparable<T> = null");
  });

  it("captures function with multiple where upper bounds", () => {
    const src = "fun <T> f() where T : Number, T : Comparable<T> {}";
    expect(checker.getSignatures(src).get("f")).toBe("fun <T> f() where T : Number, T : Comparable<T>");
  });

  it("captures annotation on same line as function", () => {
    const src = "@JvmStatic fun f() = 1";
    expect(checker.getSignatures(src).get("f")).toBe("@JvmStatic fun f()");
  });

  it("captures annotation on previous line", () => {
    const src = "@JvmStatic\nfun f() = 1";
    const text = checker.getSignatures(src).get("f");
    expect(text).toBeDefined();
    expect(text).toContain("@JvmStatic");
    expect(text).toContain("fun f()");
  });

  it("captures annotation with arguments", () => {
    const src = "@JvmStatic(\"a\") fun f() = 1";
    expect(checker.getSignatures(src).get("f")).toBe("@JvmStatic(\"a\") fun f()");
  });

  it("captures multiple annotations on function", () => {
    const src = "@JvmStatic @JvmName(\"x\")\nfun f() = 1";
    const text = checker.getSignatures(src).get("f");
    expect(text).toBeDefined();
    expect(text).toContain("@JvmStatic");
    expect(text).toContain("@JvmName");
    expect(text).toContain("fun f()");
  });

  it("captures operator function", () => {
    const src = "operator fun Int.plus(o: Int): Int = this + o";
    expect(checker.getSignatures(src).get("plus")).toBe("operator fun Int.plus(o: Int): Int");
  });

  it("captures infix function", () => {
    const src = "infix fun Int.add(o: Int): Int = this + o";
    expect(checker.getSignatures(src).get("add")).toBe("infix fun Int.add(o: Int): Int");
  });

  it("captures external function", () => {
    const src = "external fun js(s: String): Any";
    expect(checker.getSignatures(src).get("js")).toBe("external fun js(s: String): Any");
  });

  it("captures tailrec function", () => {
    const src = "tailrec fun f(n: Int): Int = if (n == 0) 1 else f(n - 1)";
    expect(checker.getSignatures(src).get("f")).toBe("tailrec fun f(n: Int): Int");
  });

  it("captures function with noinline and crossinline params", () => {
    const src = "inline fun f(noinline g: () -> Unit, crossinline h: () -> Unit) {}";
    expect(checker.getSignatures(src).get("f")).toBe("inline fun f(noinline g: () -> Unit, crossinline h: () -> Unit)");
  });

  it("captures suspend function with receiver", () => {
    const src = "suspend fun String.fetch(): String = \"\"";
    expect(checker.getSignatures(src).get("fetch")).toBe("suspend fun String.fetch(): String");
  });

  it("captures class with out variance", () => {
    const src = "class Box<out T>(val v: T)";
    expect(checker.getSignatures(src).get("Box")).toBe("class Box<out T>(val v: T)");
  });

  it("captures class with in variance", () => {
    const src = "class Box<in T>(v: T)";
    expect(checker.getSignatures(src).get("Box")).toBe("class Box<in T>(v: T)");
  });

  it("captures sealed class without including nested data classes", () => {
    const src = "sealed class S { data class A(val x: Int) : S(); data class B(val y: String) : S() }";
    expect(checker.getSignatures(src).get("S")).toBe("sealed class S");
  });

  it("captures sealed interface", () => {
    expect(checker.getSignatures("sealed interface I").get("I")).toBe("sealed interface I");
  });

  it("captures sealed interface with body", () => {
    expect(checker.getSignatures("sealed interface I { class A : I }").get("I")).toBe("sealed interface I");
  });

  it("captures value class", () => {
    const src = "value class V(val x: Int)";
    expect(checker.getSignatures(src).get("V")).toBe("value class V(val x: Int)");
  });

  it("captures @JvmInline value class", () => {
    const src = "@JvmInline value class V(val x: Int)";
    expect(checker.getSignatures(src).get("V")).toBe("@JvmInline value class V(val x: Int)");
  });

  it("captures object with inheritance", () => {
    const src = "object O : Comparable<Int> { override fun compareTo(o: Int) = 0 }";
    expect(checker.getSignatures(src).get("O")).toBe("object O : Comparable<Int>");
  });

  it("captures enum class with constructor params", () => {
    const src = "enum class E(val v: Int) { A(1), B(2) }";
    expect(checker.getSignatures(src).get("E")).toBe("enum class E(val v: Int)");
  });

  it("captures class with secondary constructor (head only)", () => {
    const src = "class C(val a: Int) { constructor(s: String) : this(s.length) }";
    expect(checker.getSignatures(src).get("C")).toBe("class C(val a: Int)");
  });

  it("captures private data class", () => {
    const src = "private data class P(val x: Int)";
    expect(checker.getSignatures(src).get("P")).toBe("private data class P(val x: Int)");
  });

  it("captures protected class", () => {
    expect(checker.getSignatures("protected class P").get("P")).toBe("protected class P");
  });

  it("captures abstract class", () => {
    expect(checker.getSignatures("abstract class A").get("A")).toBe("abstract class A");
  });

  it("captures internal interface", () => {
    expect(checker.getSignatures("internal interface I").get("I")).toBe("internal interface I");
  });

  it("captures private object", () => {
    expect(checker.getSignatures("private object O").get("O")).toBe("private object O");
  });

  it("captures companion object with named members (head only)", () => {
    const src = "class C { companion object { const val TAG = \"x\"; fun f() {} } }";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("C")).toBe("class C");
    expect(sigs.has("Companion")).toBe(false);
  });

  it("captures top-level companion object", () => {
    const src = "companion object { const val TAG = \"x\" }";
    expect(checker.getSignatures(src).get("Companion")).toBeDefined();
  });

  it("captures multiple classes each on its own line", () => {
    const src = "class A\nclass B\nclass C";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("A")).toBe("class A");
    expect(sigs.get("B")).toBe("class B");
    expect(sigs.get("C")).toBe("class C");
  });

  it("captures multiple class declarations on same line, separated by semicolons", () => {
    const src = "class A; class B; class C";
    const sigs = checker.getSignatures(src);
    expect(sigs.get("A")).toBe("class A");
    expect(sigs.has("B")).toBe(false);
  });

  it("captures typealias with nested generic types", () => {
    const src = "typealias Map2D<K> = Map<K, Map<K, Int>>";
    expect(checker.getSignatures(src).get("Map2D")).toBe("typealias Map2D<K> = Map<K, Map<K, Int>>");
  });

  it("captures typealias with where clause", () => {
    const src = "typealias Predicate<T> = (T) -> Boolean where T : Comparable<T>";
    expect(checker.getSignatures(src).get("Predicate")).toBe("typealias Predicate<T> = (T) -> Boolean where T : Comparable<T>");
  });

  it("captures function with package and import declarations", () => {
    const src = "package com.example\nimport x\n\nfun f() {}";
    expect(checker.getSignatures(src).get("f")).toBe("fun f()");
  });

  it("captures fun interface", () => {
    const src = "fun interface Producer<T> { fun produce(): T }";
    const text = checker.getSignatures(src).get("Producer");
    expect(text).toBeDefined();
    expect(text).toContain("fun interface Producer");
  });

  it("does not extract member functions inside a class body", () => {
    const src = "class C { fun inner() {} }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("inner")).toBe(false);
  });

  it("does not extract init blocks", () => {
    const src = "class C { init { println(\"hi\") } }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("init")).toBe(false);
    expect(sigs.get("C")).toBe("class C");
  });

  it("does not extract top-level properties (v1 limitation)", () => {
    const src = "val x: Int = 1\nval y: String get() = \"\"";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("x")).toBe(false);
    expect(sigs.has("y")).toBe(false);
  });

  it("does not extract delegated top-level properties (v1 limitation)", () => {
    const src = "val x: String by lazy { \"hi\" }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("x")).toBe(false);
  });

  it("does not extract top-level extension properties (v1 limitation)", () => {
    const src = "val Int.double: Int get() = this * 2";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("double")).toBe(false);
  });

  it("does not extract anonymous objects (v1 limitation)", () => {
    const src = "val o = object : Runnable { override fun run() {} }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("o")).toBe(false);
  });
});
