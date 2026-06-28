import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const kotlinSignatureChecker: SignatureChecker = {
  extensions: [".kt", ".kts"],
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

registerChecker(kotlinSignatureChecker);

interface SignatureEntry {
  name: string;
  text: string;
}

const MODS_SOURCE = String.raw`public|internal|protected|private|open|final|abstract|override|inline|infix|operator|suspend|tailrec|external|sealed`;
const MODS = `(?:(?:${MODS_SOURCE})\\s+)*`;
const CLASS_MODS = String.raw`(?:data\s+|inner\s+|enum\s+|value\s+|annotation\s+)*`;
const ANNOT = String.raw`(?:@\w+(?:\([^)]*\))?\s+)*`;

function extractSignatures(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  results.push(...extractTopLevelFuns(src));
  results.push(...extractClasses(src));
  results.push(...extractInterfaces(src));
  results.push(...extractObjects(src));
  results.push(...extractTypeAliases(src));
  return results;
}

function extractTopLevelFuns(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(`^${ANNOT}${MODS}fun\\s+`, "gm");
  for (const m of src.matchAll(re)) {
    const startIdx = m.index ?? 0;
    const name = findFunName(src, startIdx);
    if (!name) continue;
    const text = captureFunHead(src, startIdx);
    if (text && !isInsideClassBlock(src, startIdx)) {
      results.push({ name, text });
    }
  }
  return results;
}

function extractClasses(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOT}${MODS}${CLASS_MODS}class\\s+(\\w+)\\b`,
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
    `^${ANNOT}${MODS}(?:fun\\s+)?interface\\s+(\\w+)\\b`,
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

function extractObjects(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const namedRe = new RegExp(`^${ANNOT}${MODS}object\\s+(\\w+)\\b`, "gm");
  for (const m of src.matchAll(namedRe)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureClassHead(src, startIdx);
    if (text) results.push({ name, text });
  }
  const companionRe = new RegExp(`^${ANNOT}${MODS}companion\\s+object\\b`, "gm");
  for (const m of src.matchAll(companionRe)) {
    const startIdx = m.index ?? 0;
    const text = captureClassHead(src, startIdx);
    if (text) results.push({ name: "Companion", text });
  }
  return results;
}

function extractTypeAliases(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(`^${ANNOT}${MODS}typealias\\s+(\\w+)\\b`, "gm");
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureStatement(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function isInsideClassBlock(src: string, idx: number): boolean {
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

function findKeyword(src: string, startIdx: number, keyword: string): number {
  let i = skipAnnotations(src, startIdx);
  const modRe = new RegExp(`^(?:${MODS_SOURCE})\\s+`);
  while (i < src.length) {
    const before = i;
    while (i < src.length && /[ \t\n]/.test(src[i])) i++;
    const slice = src.slice(i);
    const m = slice.match(modRe);
    if (!m) break;
    i += m[0].length;
    if (i === before) break;
  }
  const withSpace = src.slice(i, i + keyword.length + 1);
  const withoutSpace = src.slice(i, i + keyword.length);
  if (withSpace !== keyword + " " && withoutSpace !== keyword) return -1;
  return i;
}

function findFunName(src: string, startIdx: number): string | undefined {
  const i = findKeyword(src, startIdx, "fun");
  if (i < 0) return undefined;
  let p = i + 3;
  if (src[p] === " ") p++;
  while (p < src.length && /[ \t]/.test(src[p])) p++;
  if (src[p] === "<") {
    const end = matchAngle(src, p);
    if (end < 0) return undefined;
    p = end + 1;
  }
  while (p < src.length && /[ \t\n]/.test(src[p])) p++;
  const nameStart = p;
  while (p < src.length && (/[A-Za-z_0-9]/.test(src[p]) || src[p] === ".")) {
    p++;
  }
  if (p === nameStart) return undefined;
  const fullName = src.slice(nameStart, p);
  const dot = fullName.lastIndexOf(".");
  return dot >= 0 ? fullName.slice(dot + 1) : fullName;
}

function captureFunHead(src: string, startIdx: number): string | undefined {
  const i = findKeyword(src, startIdx, "fun");
  if (i < 0) return undefined;
  let p = i + 3;
  if (src[p] === " ") p++;
  while (p < src.length && /[ \t]/.test(src[p])) p++;
  if (src[p] === "<") {
    const end = matchAngle(src, p);
    if (end < 0) return undefined;
    p = end + 1;
  }
  while (p < src.length && /[ \t\n]/.test(src[p])) p++;
  while (p < src.length && (/[A-Za-z_0-9]/.test(src[p]) || src[p] === ".")) {
    p++;
  }
  if (src[p] === "<") {
    const end = matchAngle(src, p);
    if (end < 0) return undefined;
    p = end + 1;
  }
  const openIdx = src.indexOf("(", p);
  if (openIdx < 0) return undefined;
  const closeIdx = matchParen(src, openIdx);
  if (closeIdx < 0) return undefined;
  p = closeIdx + 1;
  while (p < src.length && /[ \t\n]/.test(src[p])) p++;
  if (src[p] === ":") {
    p++;
    while (p < src.length && /[ \t\n]/.test(src[p])) p++;
    const typeEnd = findTypeEnd(src, p);
    if (typeEnd > p) p = typeEnd;
  }
  if (src[p] === "{" || src[p] === "=") return src.slice(startIdx, p).trimEnd();
  const blockStart = src.indexOf("{", p);
  const endIdx = blockStart >= 0 ? blockStart : src.length;
  return src.slice(startIdx, endIdx).trimEnd();
}

function skipAnnotations(src: string, from: number): number {
  let i = from;
  while (i < src.length) {
    while (i < src.length && /[ \t\n]/.test(src[i])) i++;
    if (src[i] !== "@") break;
    i++;
    while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
    if (src[i] === "(") {
      const close = matchParen(src, i);
      if (close < 0) return i;
      i = close + 1;
    }
  }
  return i;
}

function captureClassHead(src: string, startIdx: number): string | undefined {
  let i = skipAnnotations(src, startIdx);
  let braceDepth = 0;
  let parenDepth = 0;
  let angleDepth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "{") {
      if (braceDepth === 0 && parenDepth === 0 && angleDepth === 0) {
        return src.slice(startIdx, i).trimEnd();
      }
      braceDepth++;
    } else if (ch === "}") {
      if (braceDepth > 0) braceDepth--;
    } else if (ch === "(") {
      parenDepth++;
    } else if (ch === ")") {
      if (parenDepth > 0) parenDepth--;
    } else if (ch === "<") {
      angleDepth++;
    } else if (ch === ">") {
      if (angleDepth > 0) angleDepth--;
    } else if (ch === ";" && braceDepth === 0 && parenDepth === 0 && angleDepth === 0) {
      return src.slice(startIdx, i).trimEnd();
    } else if (ch === "\n" && braceDepth === 0 && parenDepth === 0 && angleDepth === 0) {
      return src.slice(startIdx, i).trimEnd();
    }
    i++;
  }
  return src.slice(startIdx).trimEnd();
}

function captureStatement(src: string, startIdx: number): string | undefined {
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      continue;
    }
    if (ch === "{") return undefined;
    if (ch === "\n") return src.slice(startIdx, i).trimEnd();
  }
  return src.slice(startIdx).trimEnd();
}

function findTypeEnd(src: string, from: number): number {
  let angleDepth = 0;
  let braceDepth = 0;
  let parenDepth = 0;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === "<") angleDepth++;
    else if (ch === ">") {
      if (angleDepth > 0) angleDepth--;
    } else if (ch === "{") {
      if (braceDepth === 0 && angleDepth === 0 && parenDepth === 0) return i;
      braceDepth++;
    } else if (ch === "}") {
      if (braceDepth > 0) braceDepth--;
    } else if (ch === "(") {
      parenDepth++;
    } else if (ch === ")") {
      if (parenDepth > 0) parenDepth--;
    } else if ((ch === ";" || ch === "\n" || ch === "=") && angleDepth === 0 && braceDepth === 0 && parenDepth === 0) {
      return i;
    }
  }
  return src.length;
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
    }
  }
  return -1;
}

function matchAngle(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === "<") depth++;
    else if (c === ">") {
      depth--;
      if (depth === 0) return i;
    } else if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
    } else if (c === "(") {
      const close = matchParen(src, i);
      if (close < 0) return -1;
      i = close;
    }
  }
  return -1;
}
