import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const tsChecker: SignatureChecker = {
  extensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"],
  getSignatures(src: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const entry of extractSignatures(src)) {
      const existing = map.get(entry.name);
      if (existing === undefined) {
        map.set(entry.name, entry.text);
      } else {
        map.set(entry.name, existing + "\n" + entry.text);
      }
    }
    return map;
  },
};

registerChecker(tsChecker);

const ANNOTATION_PREFIX = String.raw`(?:@[^\n]*\n)*[ \t]*`;
const MODIFIERS = String.raw`(?:export\s+(?:default\s+)?)?(?:abstract\s+|declare\s+|async\s+)*`;

interface SignatureEntry {
  name: string;
  text: string;
}

function extractSignatures(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  results.push(...extractFunctions(src));
  results.push(...extractClasses(src));
  results.push(...extractInterfaces(src));
  results.push(...extractTypeAliases(src));
  return results;
}

function extractFunctions(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODIFIERS}(?:function\\s*\\*?)\\s+(\\w+)\\b`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureCallSignature(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractClasses(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODIFIERS}class\\s+(\\w+)\\b`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureClassHead(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractInterfaces(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODIFIERS}interface\\s+(\\w+)\\b`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureBlock(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractTypeAliases(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODIFIERS}type\\s+(\\w+)\\b`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureStatement(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function captureCallSignature(src: string, startIdx: number): string | undefined {
  const openIdx = findUnnested(src, startIdx, "(", ["(", "[", "{", "<"]);
  if (openIdx < 0) return undefined;
  const closeIdx = matchBracket(src, openIdx);
  if (closeIdx < 0) return undefined;

  let i = closeIdx + 1;
  while (i < src.length && /[ \t\n]/.test(src[i])) i++;
  if (src[i] === ":") {
    i++;
    while (i < src.length && /[ \t\n]/.test(src[i])) i++;
    const typeEnd = findTypeEnd(src, i);
    if (typeEnd > i) i = typeEnd;
  }
  while (i < src.length && src[i] !== "{" && src[i] !== ";" && src[i] !== "\n") {
    if (src[i] === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    i++;
  }
  return src.slice(startIdx, i).trimEnd();
}

function captureClassHead(src: string, startIdx: number): string | undefined {
  let i = startIdx;
  let parenDepth = 0;
  let angleDepth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "{") {
      return src.slice(startIdx, i).trimEnd();
    }
    if (ch === "(") parenDepth++;
    else if (ch === ")") parenDepth--;
    else if (ch === "<") angleDepth++;
    else if (ch === ">") {
      if (angleDepth > 0) angleDepth--;
    }
    if ((ch === "\n" || ch === ";") && parenDepth === 0 && angleDepth === 0) {
      return src.slice(startIdx, i).trimEnd();
    }
    i++;
  }
  return src.slice(startIdx).trimEnd();
}

function captureBlock(src: string, startIdx: number): string | undefined {
  const braceStart = src.indexOf("{", startIdx);
  if (braceStart < 0) return undefined;
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return src.slice(startIdx, i + 1).trimEnd();
      }
    }
  }
  return undefined;
}

function captureStatement(src: string, startIdx: number): string | undefined {
  let depth = 0;
  let angleDepth = 0;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      if (depth > 0) depth--;
    }
    else if (ch === "<") angleDepth++;
    else if (ch === ">") {
      if (angleDepth > 0) angleDepth--;
    }
    if (ch === ";" && depth === 0 && angleDepth === 0) {
      return src.slice(startIdx, i + 1).trimEnd();
    }
    if (ch === "\n" && depth === 0 && angleDepth === 0 && i > startIdx) {
      const ahead = src.slice(i + 1, i + 5);
      if (!/^[ \t]*(&|\|)/.test(ahead)) return src.slice(startIdx, i).trimEnd();
    }
  }
  return undefined;
}

function findUnnested(src: string, from: number, target: string, opens: string[]): number {
  const openset = new Set(opens.filter((o) => o !== target));
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (openset.has(ch)) depth++;
    else if (depth === 0 && ch === target) return i;
  }
  return -1;
}

function matchBracket(src: string, openIdx: number): number {
  const ch = src[openIdx];
  const matching: Record<string, string> = { "(": ")", "[": "]", "{": "}", "<": ">" };
  const closer = matching[ch];
  if (!closer) return -1;
  const stack: string[] = [];
  for (let i = openIdx + 1; i < src.length; i++) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (c === "(" || c === "[" || c === "{" || c === "<") {
      if (ch === "<" && c === "<") {
        // nested generic - treat as bracket pair
        stack.push(c);
      } else if (ch === "<") {
        // comparison operator in default value; bail out
        return -1;
      } else {
        stack.push(c);
      }
    } else if (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (
        (top === "(" && c === ")") ||
        (top === "[" && c === "]") ||
        (top === "{" && c === "}") ||
        (top === "<" && c === ">")
      ) {
        stack.pop();
      }
    }
    if (c === closer && stack.length === 0) return i;
  }
  return -1;
}

function findTypeEnd(src: string, from: number): number {
  let depth = 0;
  let angleDepth = 0;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === "<") angleDepth++;
    else if (ch === ">") {
      if (angleDepth > 0) angleDepth--;
    }
    if ((ch === "{" || ch === ";" || ch === "\n" || ch === "," || ch === ")") && depth === 0 && angleDepth === 0) {
      return i;
    }
  }
  return src.length;
}