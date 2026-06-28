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
const FUNC_KEYWORD = String.raw`(?:function\s*\*?|class|interface|type)`;

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
    `^${ANNOTATION_PREFIX}${MODIFIERS}(?:function\\s*\\*?)\\s+(\\w+)\\s*(<[^;{]*?>)?\\s*\\(`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureHead(src, startIdx, m[0]);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractClasses(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODIFIERS}class\\s+(\\w+)\\s*(<[^;{]*?>)?(?:\\s+extends\\s+[^{]+)?(?:\\s+implements\\s+[^{]+)?`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureHead(src, startIdx, m[0]);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractInterfaces(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODIFIERS}interface\\s+(\\w+)\\s*(<[^;{]*?>)?(?:\\s+extends\\s+[^{]+)?`,
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
    `^${ANNOTATION_PREFIX}${MODIFIERS}type\\s+(\\w+)\\s*(<[^;=]*?>)?\\s*=`,
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

function captureHead(src: string, startIdx: number, headMatch: string): string | undefined {
  const equalsAt = headMatch.indexOf("{");
  const semiAt = headMatch.indexOf(";");
  let endOfLine = headMatch.length;
  if (equalsAt >= 0 && (semiAt < 0 || equalsAt < semiAt)) {
    endOfLine = equalsAt;
  } else if (semiAt >= 0) {
    endOfLine = semiAt;
  }
  const text = headMatch.slice(0, endOfLine).trimEnd();
  if (text.endsWith(";")) return text;
  return text;
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

// Suppress unused-keyword compile warning for shared patterns (kept for parity with export checker style).
void FUNC_KEYWORD;