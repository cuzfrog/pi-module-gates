import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const rustSignatureChecker: SignatureChecker = {
  extensions: [".rs"],
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

registerChecker(rustSignatureChecker);

interface SignatureEntry {
  name: string;
  text: string;
}

function extractSignatures(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  results.push(...extractFunctions(src));
  results.push(...extractTraits(src));
  results.push(...extractImpls(src));
  results.push(...extractStructs(src));
  results.push(...extractEnums(src));
  results.push(...extractTypeAliases(src));
  return results;
}

const VIS = String.raw`(?:pub(?:\((?:crate|super|self|in\s+[A-Za-z_][\w:]*)\))?\s+)?`;
const SAFETY = String.raw`(?:async\s+|const\s+|unsafe\s+|extern\s+(?:"[^"]+"\s+)?)*`;
const GENERIC_HEAD = String.raw`(?:<[^<>]*(?:<[^<>]*>[^<>]*)*>)?`;
const ATTR_LINE = String.raw`(?:(?:\/\/\/|\/\/!)[^\n]*\n|\s*#!\[[^\]]*\]\n|\s*#\[[^\]]*\]\n)*`;

function extractFunctions(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ATTR_LINE}${VIS}${SAFETY}fn\\s+(\\w+)${GENERIC_HEAD}`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureFnHead(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractTraits(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ATTR_LINE}${VIS}(?:(?:unsafe|const)\\s+)?trait\\s+(\\w+)${GENERIC_HEAD}`,
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

function extractImpls(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ATTR_LINE}${VIS}(?:unsafe\\s+)?impl(?:<[^>]*>)?\\s+(\\w+)(?:<[^>]*>)?\\s+for\\s+(\\w+)(?:<[^>]*>)?`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const traitName = m[1];
    const targetName = m[2];
    const startIdx = m.index ?? 0;
    const text = captureBlock(src, startIdx);
    if (!text) continue;
    const key = `impl ${traitName} for ${targetName}`;
    results.push({ name: key, text });
  }
  return results;
}

function extractStructs(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ATTR_LINE}${VIS}struct\\s+(\\w+)${GENERIC_HEAD}`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureStructHead(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractEnums(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ATTR_LINE}${VIS}enum\\s+(\\w+)${GENERIC_HEAD}`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = m.index ?? 0;
    const text = captureStructHead(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractTypeAliases(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ATTR_LINE}${VIS}type\\s+(\\w+)${GENERIC_HEAD}\\s*=`,
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

function captureFnHead(src: string, startIdx: number): string | undefined {
  const openIdx = src.indexOf("(", startIdx);
  if (openIdx < 0) return undefined;
  const closeIdx = matchParen(src, openIdx);
  if (closeIdx < 0) return undefined;
  let i = closeIdx + 1;
  while (i < src.length && /[ \t\n]/.test(src[i])) i++;
  if (src[i] === "-" && src[i + 1] === ">") {
    i += 2;
    while (i < src.length && /[ \t\n]/.test(src[i])) i++;
  }
  if (src[i] === "{") return src.slice(startIdx, i).trimEnd();
  const endIdx = findStatementEnd(src, i);
  return src.slice(startIdx, endIdx).trimEnd();
}

function findStatementEnd(src: string, startIdx: number): number {
  let i = startIdx;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let angleDepth = 0;
  while (i < src.length) {
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
    if (ch === '"') {
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === "{") {
      if (parenDepth === 0 && bracketDepth === 0 && angleDepth === 0) return i;
      braceDepth++;
    } else if (ch === "}") {
      if (braceDepth > 0) braceDepth--;
    } else if (ch === "[") {
      bracketDepth++;
    } else if (ch === "]") {
      if (bracketDepth > 0) bracketDepth--;
    } else if (ch === "(") {
      parenDepth++;
    } else if (ch === ")") {
      if (parenDepth > 0) parenDepth--;
    } else if (ch === "<") {
      angleDepth++;
    } else if (ch === ">") {
      if (angleDepth > 0) angleDepth--;
    } else if (ch === ";") {
      if (parenDepth === 0 && bracketDepth === 0 && angleDepth === 0) return i;
    }
    i++;
  }
  return src.length;
}

function captureStructHead(src: string, startIdx: number): string | undefined {
  let i = startIdx;
  let braceDepth = 0;
  let parenDepth = 0;
  let angleDepth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "{") {
      if (braceDepth === 0 && parenDepth === 0 && angleDepth === 0) return src.slice(startIdx, i).trimEnd();
      braceDepth++;
    } else if (ch === "}") {
      if (braceDepth > 0) braceDepth--;
    } else if (ch === "<") {
      angleDepth++;
    } else if (ch === ">") {
      if (angleDepth > 0) angleDepth--;
    } else if (ch === "(") {
      parenDepth++;
    } else if (ch === ")") {
      if (parenDepth > 0) parenDepth--;
    } else if (ch === ";") {
      if (braceDepth === 0 && parenDepth === 0 && angleDepth === 0) return src.slice(startIdx, i).trimEnd();
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
    }
  }
  return undefined;
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
    if (ch === ";") return src.slice(startIdx, i + 1).trimEnd();
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
    }
  }
  return -1;
}
