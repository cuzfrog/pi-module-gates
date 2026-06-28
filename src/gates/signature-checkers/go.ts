import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const goSignatureChecker: SignatureChecker = {
  extensions: [".go"],
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

registerChecker(goSignatureChecker);

interface SignatureEntry {
  name: string;
  text: string;
}

function extractSignatures(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  results.push(...extractFunctions(src));
  results.push(...extractTypes(src));
  return results;
}

function extractFunctions(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^func\\s+(?:\\([^)]*\\)\\s+)?(\\w+)(?:\\[[^\\]]*\\])?\\s*\\(`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureFuncHead(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractTypes(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^type\\s+(\\w+)(?:\\[[^\\]]*\\])?\\s+`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureTypeDecl(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function captureFuncHead(src: string, startIdx: number): string | undefined {
  const openIdx = src.indexOf("(", startIdx);
  if (openIdx < 0) return undefined;
  const closeIdx = matchParen(src, openIdx);
  if (closeIdx < 0) return undefined;
  let i = closeIdx + 1;
  while (i < src.length && /[ \t\n]/.test(src[i])) i++;
  const blockStart = src.indexOf("{", i);
  const endIdx = blockStart >= 0 ? blockStart : src.length;
  return src.slice(startIdx, endIdx).trimEnd();
}

function captureTypeDecl(src: string, startIdx: number): string | undefined {
  const endIdx = findTypeEnd(src, startIdx);

  const headText = src.slice(startIdx, endIdx).trimEnd();
  if (/\binterface\b/.test(headText)) {
    return captureBlock(src, startIdx);
  }
  return headText;
}

function findTypeEnd(src: string, from: number): number {
  let depth = 0;
  let bracketDepth = 0;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\n" && depth === 0 && bracketDepth === 0) return i;
    if (ch === "{") {
      if (depth === 0 && bracketDepth === 0) return i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) depth--;
    } else if (ch === "[") {
      bracketDepth++;
    } else if (ch === "]") {
      if (bracketDepth > 0) bracketDepth--;
    }
  }
  return src.length;
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
    } else if (ch === "`") {
      i++;
      while (i < src.length && src[i] !== "`") i++;
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
    } else if (c === "`") {
      i++;
      while (i < src.length && src[i] !== "`") i++;
    }
  }
  return -1;
}
