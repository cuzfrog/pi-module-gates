import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const javaSignatureChecker: SignatureChecker = {
  extensions: [".java"],
  getSignatures(src: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const entry of extractSignatures(src)) {
      const text = entry.text.trim();
      const existing = map.get(entry.name);
      if (existing === undefined) {
        map.set(entry.name, text);
      } else {
        map.set(entry.name, existing + "\n" + text);
      }
    }
    return map;
  },
};

registerChecker(javaSignatureChecker);

interface SignatureEntry {
  name: string;
  text: string;
}

function extractSignatures(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  results.push(...extractMethods(src));
  results.push(...extractClasses(src));
  results.push(...extractInterfaces(src));
  results.push(...extractEnums(src));
  results.push(...extractRecords(src));
  results.push(...extractTypeAnnotations(src));
  return results;
}

const MODS = String.raw`(?:public\s+|protected\s+|private\s+|static\s+|final\s+|abstract\s+|synchronized\s+|native\s+|strictfp\s+|default\s+|sealed\s+|non-sealed\s+)*`;
const GENERIC_HEAD = String.raw`(?:<[^>]*>)?`;
const THROWS = String.raw`(?:\s+throws\s+[\w$.,\s<>&]+)?`;
const RETURN = String.raw`[\w$<>,\[\]\s.&]+?`;
const TYPE_KEYWORDS = new Set(["record", "class", "interface", "enum"]);

function extractMethods(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${MODS}${GENERIC_HEAD}${RETURN}\\s+(\\w+)${GENERIC_HEAD}\\s*\\(`,
    "gm",
  );
  const modsRe = new RegExp(`^${MODS}${GENERIC_HEAD}`);
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    if (isTypeDeclarationReturn(src, startIdx, modsRe)) continue;
    const text = captureMethodHead(src, startIdx);
    if (text && !isMethodInsideClassBlock(src, startIdx)) {
      results.push({ name, text });
    }
  }
  return results;
}

function isTypeDeclarationReturn(src: string, startIdx: number, modsRe: RegExp): boolean {
  const head = src.slice(startIdx);
  const m = head.match(modsRe);
  const i = m ? startIdx + m[0].length : startIdx;
  let wordEnd = i;
  while (wordEnd < src.length && /[\w$]/.test(src[wordEnd])) wordEnd++;
  const word = src.slice(i, wordEnd);
  return TYPE_KEYWORDS.has(word);
}

function extractClasses(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${MODS}class\\s+(\\w+)${GENERIC_HEAD}`,
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
    `^${MODS}interface\\s+(\\w+)${GENERIC_HEAD}`,
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

function extractEnums(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${MODS}enum\\s+(\\w+)`,
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

function extractRecords(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${MODS}record\\s+(\\w+)${GENERIC_HEAD}\\s*\\(`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureRecordHead(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractTypeAnnotations(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${MODS}@interface\\s+(\\w+)`,
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

function isMethodInsideClassBlock(src: string, idx: number): boolean {
  let depth = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const ch = src[i];
    if (ch === "}") depth++;
    else if (ch === "{") {
      if (depth === 0) return true;
      depth--;
    }
  }
  return false;
}

function captureMethodHead(src: string, startIdx: number): string | undefined {
  const openIdx = src.indexOf("(", startIdx);
  if (openIdx < 0) return undefined;
  const closeIdx = matchParen(src, openIdx);
  if (closeIdx < 0) return undefined;
  let i = closeIdx + 1;
  while (i < src.length && /[ \t\n]/.test(src[i])) i++;
  const throwsMatch = src.slice(i).match(/^throws\s+[\w$.,\s]+/);
  if (throwsMatch) {
    i += throwsMatch[0].length;
    while (i < src.length && /[ \t\n]/.test(src[i])) i++;
  }
  if (src[i] === "{" || src[i] === ";") return src.slice(startIdx, i).trimEnd();
  const blockStart = src.indexOf("{", i);
  const semiStart = src.indexOf(";", i);
  let endIdx = src.length;
  if (blockStart >= 0) endIdx = Math.min(endIdx, blockStart);
  if (semiStart >= 0) endIdx = Math.min(endIdx, semiStart);
  return src.slice(startIdx, endIdx).trimEnd();
}

function captureClassHead(src: string, startIdx: number): string | undefined {
  let i = startIdx;
  let braceDepth = 0;
  let angleDepth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "{") {
      if (braceDepth === 0 && angleDepth === 0) return src.slice(startIdx, i).trimEnd();
      braceDepth++;
    } else if (ch === "}") {
      if (braceDepth > 0) braceDepth--;
    } else if (ch === "<") {
      angleDepth++;
    } else if (ch === ">") {
      if (angleDepth > 0) angleDepth--;
    }
    i++;
  }
  return src.slice(startIdx).trimEnd();
}

function captureRecordHead(src: string, startIdx: number): string | undefined {
  const openIdx = src.indexOf("(", startIdx);
  if (openIdx < 0) return undefined;
  const closeIdx = matchParen(src, openIdx);
  if (closeIdx < 0) return undefined;
  let i = closeIdx + 1;
  while (i < src.length && /[ \t\n]/.test(src[i])) i++;
  const headerEnd = src.indexOf("{", i);
  if (headerEnd < 0) return src.slice(startIdx).trimEnd();
  return src.slice(startIdx, headerEnd).trimEnd();
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
      if (depth === 0) return src.slice(startIdx, i + 1).trimEnd();
    } else if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
    } else if (ch === '"') {
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") i++;
        i++;
      }
    } else if (ch === "'") {
      i++;
      while (i < src.length && src[i] !== "'") {
        if (src[i] === "\\") i++;
        i++;
      }
    }
  }
  return undefined;
}

function matchParen(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    } else if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
    } else if (c === '"') {
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") i++;
        i++;
      }
    } else if (c === "'") {
      i++;
      while (i < src.length && src[i] !== "'") {
        if (src[i] === "\\") i++;
        i++;
      }
    }
  }
  return -1;
}
