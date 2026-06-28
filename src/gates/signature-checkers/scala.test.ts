import { describe, it, expect } from "vitest";
import { getSignatureChecker } from "./registry.ts";
import "./scala.ts";

describe("Scala signature checker", () => {
  const checker = getSignatureChecker("/File.scala")!;

  it("captures simple def with return type", () => {
    const src = "def add(a: Int, b: Int): Int = a + b";
    expect(checker.getSignatures(src).get("add")).toBe("def add(a: Int, b: Int): Int =");
  });

  it("captures def with no params and no return type", () => {
    const src = "def hello(): Unit = println(\"hi\")";
    expect(checker.getSignatures(src).get("hello")).toBe("def hello(): Unit =");
  });

  it("captures def with multiple parameter lists (currying)", () => {
    const src = "def curried(a: Int)(b: Int): Int = a + b";
    expect(checker.getSignatures(src).get("curried")).toBe("def curried(a: Int)(b: Int): Int =");
  });

  it("captures def with generic params", () => {
    const src = "def identity[T](x: T): T = x";
    expect(checker.getSignatures(src).get("identity")).toBe("def identity[T](x: T): T =");
  });

  it("captures private def", () => {
    const src = "private def helper(): String = \"\"";
    expect(checker.getSignatures(src).get("helper")).toBe("private def helper(): String =");
  });

  it("captures abstract def", () => {
    const src = "def abstractMethod(x: Int): Boolean";
    expect(checker.getSignatures(src).get("abstractMethod")).toBe("def abstractMethod(x: Int): Boolean");
  });

  it("captures override def with modifiers", () => {
    const src = "override def toString: String = \"x\"";
    expect(checker.getSignatures(src).get("toString")).toBe("override def toString: String =");
  });

  it("captures inline def", () => {
    const src = "inline def f(x: Int): Int = x";
    expect(checker.getSignatures(src).get("f")).toBe("inline def f(x: Int): Int =");
  });

  it("captures class head with primary constructor params", () => {
    const src = "class User(val name: String, val age: Int) { def greet(): String = name }";
    const text = checker.getSignatures(src).get("User");
    expect(text).toBeDefined();
    expect(text).toContain("class User");
    expect(text).toContain("(val name: String, val age: Int)");
    expect(text).not.toContain("def greet");
  });

  it("captures generic class head", () => {
    const src = "class Box[T](value: T) {}";
    const text = checker.getSignatures(src).get("Box");
    expect(text).toBeDefined();
    expect(text).toContain("class Box");
    expect(text).toContain("[T]");
  });

  it("captures case class head", () => {
    const src = "case class Point(x: Int, y: Int)";
    const text = checker.getSignatures(src).get("Point");
    expect(text).toBe("case class Point(x: Int, y: Int)");
  });

  it("captures case class with extends", () => {
    const src = "case class Ok(value: Int) extends Result[Int]";
    const text = checker.getSignatures(src).get("Ok");
    expect(text).toBe("case class Ok(value: Int) extends Result[Int]");
  });

  it("captures object declaration head", () => {
    const src = "object Singleton { def callMe(): Unit = () }";
    const text = checker.getSignatures(src).get("Singleton");
    expect(text).toBe("object Singleton");
  });

  it("captures case object", () => {
    const src = "case object None";
    const text = checker.getSignatures(src).get("None");
    expect(text).toBe("case object None");
  });

  it("captures trait head", () => {
    const src = "trait Greet { def hello(name: String): String }";
    const text = checker.getSignatures(src).get("Greet");
    expect(text).toBe("trait Greet");
  });

  it("captures sealed trait head", () => {
    const src = "sealed trait Result[+T]";
    const text = checker.getSignatures(src).get("Result");
    expect(text).toBe("sealed trait Result[+T]");
  });

  it("captures type alias RHS", () => {
    const src = "type StringMap = Map[String, String]";
    expect(checker.getSignatures(src).get("StringMap")).toBe("type StringMap = Map[String, String]");
  });

  it("captures generic type alias", () => {
    const src = "type Handler[T] = T => Unit";
    expect(checker.getSignatures(src).get("Handler")).toBe("type Handler[T] = T => Unit");
  });

  it("captures abstract type member", () => {
    const src = "type Key";
    expect(checker.getSignatures(src).get("Key")).toBe("type Key");
  });

  it("does not extract member defs inside a class", () => {
    const src = "class C { def inner(): Int = 1 }";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("inner")).toBe(false);
  });

  it("captures top-level def alongside a class", () => {
    const src = [
      "class Box { def inner(): Int = 1 }",
      "def top(): Int = 1",
    ].join("\n");
    const sigs = checker.getSignatures(src);
    expect(sigs.has("Box")).toBe(true);
    expect(sigs.has("top")).toBe(true);
    expect(sigs.has("inner")).toBe(false);
  });

  it("captures def with implicit param list", () => {
    const src = "def greet(name: String)(implicit greeting: String): String = s\"$greeting $name\"";
    const text = checker.getSignatures(src).get("greet");
    expect(text).toBeDefined();
    expect(text).toContain("def greet");
    expect(text).toContain("name: String");
  });

  it("captures def with using clause (Scala 3)", () => {
    const src = "def f(x: Int)(using Ord[Int]): Int = x";
    expect(checker.getSignatures(src).get("f")).toBe("def f(x: Int)(using Ord[Int]): Int =");
  });

  it("captures def with by-name parameter", () => {
    const src = "def f(x: => Int): Int = x";
    expect(checker.getSignatures(src).get("f")).toBe("def f(x: => Int): Int =");
  });

  it("captures def with vararg parameter", () => {
    const src = "def f(xs: Int*): Int = xs.sum";
    expect(checker.getSignatures(src).get("f")).toBe("def f(xs: Int*): Int =");
  });

  it("captures def with context bound", () => {
    const src = "def f[A: Ordering](x: A): A = x";
    expect(checker.getSignatures(src).get("f")).toBe("def f[A: Ordering](x: A): A =");
  });

  it("captures def with view bound (legacy)", () => {
    const src = "def f[A <% Comparable[A]](x: A): A = x";
    expect(checker.getSignatures(src).get("f")).toBe("def f[A <% Comparable[A]](x: A): A =");
  });

  it("captures def with type lambda (kind-1)", () => {
    const src = "def f[F[_]]: F[Int] = ???";
    expect(checker.getSignatures(src).get("f")).toBe("def f[F[_]]: F[Int] =");
  });

  it("captures def with higher-kinded type", () => {
    const src = "def f[G[_[_]]]: G[List] = ???";
    expect(checker.getSignatures(src).get("f")).toBe("def f[G[_[_]]]: G[List] =");
  });

  it("captures def with private[this] modifier", () => {
    const src = "private[this] def secret(x: Int): Int = x";
    expect(checker.getSignatures(src).get("secret")).toBe("private[this] def secret(x: Int): Int =");
  });

  it("captures def with private[package] modifier", () => {
    const src = "private[somepkg] def secret(x: Int): Int = x";
    expect(checker.getSignatures(src).get("secret")).toBe("private[somepkg] def secret(x: Int): Int =");
  });

  it("captures class with extends and with mixins", () => {
    const src = "class A extends B with C with D";
    expect(checker.getSignatures(src).get("A")).toBe("class A extends B with C with D");
  });

  it("captures sealed class extends", () => {
    const src = "sealed class A extends B";
    expect(checker.getSignatures(src).get("A")).toBe("sealed class A extends B");
  });

  it("captures trait extends parent trait", () => {
    const src = "trait A extends B";
    expect(checker.getSignatures(src).get("A")).toBe("trait A extends B");
  });

  it("captures case class with default param values", () => {
    const src = "case class P(x: Int = 0, y: String = \"\")";
    expect(checker.getSignatures(src).get("P")).toBe("case class P(x: Int = 0, y: String = \"\")");
  });

  it("merges case class with companion object", () => {
    const src = "case class P(x: Int)\nobject P";
    const sigs = checker.getSignatures(src);
    expect(sigs.has("P")).toBe(true);
    expect(sigs.get("P")).toContain("case class P(x: Int)");
    expect(sigs.get("P")).toContain("object P");
  });

  it("captures object extending class", () => {
    const src = "object O extends Super";
    expect(checker.getSignatures(src).get("O")).toBe("object O extends Super");
  });

  it("captures object extending trait", () => {
    const src = "object O extends Trait";
    expect(checker.getSignatures(src).get("O")).toBe("object O extends Trait");
  });

  it("captures abstract type with upper bound", () => {
    const src = "type A <: Bound";
    expect(checker.getSignatures(src).get("A")).toBe("type A <: Bound");
  });

  it("captures abstract type with lower bound", () => {
    const src = "type A >: Lower";
    expect(checker.getSignatures(src).get("A")).toBe("type A >: Lower");
  });

  it("captures type alias with covariance", () => {
    const src = "type +T";
    expect(checker.getSignatures(src).get("T")).toBe("type +T");
  });

  it("captures type alias with covariance and upper bound", () => {
    const src = "type +T <: Upper";
    expect(checker.getSignatures(src).get("T")).toBe("type +T <: Upper");
  });

  it("captures def with match expression body", () => {
    const src = "def f(x: Int): String = x match { case 0 => \"zero\" case _ => \"many\" }";
    expect(checker.getSignatures(src).get("f")).toBe("def f(x: Int): String =");
  });

  it("captures def with for-comprehension body", () => {
    const src = "def f(xs: List[Int]): List[Int] = for (x <- xs) yield x * 2";
    expect(checker.getSignatures(src).get("f")).toBe("def f(xs: List[Int]): List[Int] =");
  });

  it("captures def returning function type", () => {
    const src = "def f: Int => String = _.toString";
    expect(checker.getSignatures(src).get("f")).toBe("def f: Int => String =");
  });

  it("captures abstract def with function type return", () => {
    const src = "def f: Int => String";
    expect(checker.getSignatures(src).get("f")).toBe("def f: Int => String");
  });

  it("captures abstract def with structural type return", () => {
    const src = "def f: { val x: Int }";
    expect(checker.getSignatures(src).get("f")).toBe("def f: { val x: Int }");
  });

  it("captures def with type lambda in generic constraint", () => {
    const src = "def f[F <: [X] =>> X]: F[Int] = ???";
    expect(checker.getSignatures(src).get("f")).toBe("def f[F <: [X] =>> X]: F[Int] =");
  });

  it("captures inline annotation on def", () => {
    const src = "@deprecated def f(): Int = 1";
    expect(checker.getSignatures(src).get("f")).toBe("def f(): Int =");
  });

  it("captures line-prefixed annotation on def", () => {
    const src = "@deprecated\n@inline\ndef f(): Int = 1";
    expect(checker.getSignatures(src).get("f")).toBe("def f(): Int =");
  });

  it("captures annotation on case class", () => {
    const src = "@SerialVersionUID(1L)\ncase class P(x: Int)";
    expect(checker.getSignatures(src).get("P")).toBe("case class P(x: Int)");
  });

  it("captures private[scope] class", () => {
    const src = "private[foo] class Secret";
    expect(checker.getSignatures(src).get("Secret")).toBe("private[foo] class Secret");
  });

  it("captures private[scope] object", () => {
    const src = "private[foo] object Secret";
    expect(checker.getSignatures(src).get("Secret")).toBe("private[foo] object Secret");
  });

  it("captures private[scope] trait", () => {
    const src = "private[foo] trait Secret";
    expect(checker.getSignatures(src).get("Secret")).toBe("private[foo] trait Secret");
  });

  it("does not extract top-level val (out of scope)", () => {
    const src = "val x: Int = 1";
    expect(checker.getSignatures(src).has("x")).toBe(false);
  });

  it("does not extract top-level lazy val (out of scope)", () => {
    const src = "lazy val x: Int = 1";
    expect(checker.getSignatures(src).has("x")).toBe(false);
  });

  it("does not extract Scala 3 enum (out of scope, different shape)", () => {
    const src = "enum Color { case Red, Green, Blue }";
    expect(checker.getSignatures(src).size).toBe(0);
  });

  it("does not extract Scala 3 extension methods (out of scope, indented body)", () => {
    const src = "extension (s: String)\n  def shout: String = s.toUpperCase";
    expect(checker.getSignatures(src).size).toBe(0);
  });

  it("does not extract Scala 3 given (out of scope, different shape)", () => {
    const src = "given Ord[Int] with\n  def compare(x: Int, y: Int): Int = x - y";
    expect(checker.getSignatures(src).size).toBe(0);
  });

  it("does not extract Scala 3 export (out of scope)", () => {
    const src = "export math.{sin, cos}";
    expect(checker.getSignatures(src).size).toBe(0);
  });

  it("does not extract Scala 2 package object (out of scope)", () => {
    const src = "package object mypkg { def f: Int = 1 }";
    expect(checker.getSignatures(src).size).toBe(0);
  });

  it("does not extract private[scope] val (out of scope, val is not a signature)", () => {
    const src = "private[foo] val s: Int = 1";
    expect(checker.getSignatures(src).has("s")).toBe(false);
  });

  it("captures annotated type alias", () => {
    const src = "@specialized\ntype +T <: Upper";
    expect(checker.getSignatures(src).get("T")).toBe("type +T <: Upper");
  });
});
