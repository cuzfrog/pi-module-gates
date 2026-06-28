import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const scalaSignatureChecker: SignatureChecker = {
  extensions: [".scala", ".sc"],
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

registerChecker(scalaSignatureChecker);

interface SignatureEntry {
  name: string;
  text: string;
}

function extractSignatures(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  results.push(...extractDefs(src));
  results.push(...extractClasses(src));
  results.push(...extractObjects(src));
  results.push(...extractTraits(src));
  results.push(...extractTypeAliases(src));
  return results;
}

const MODS = String.raw`(?:(?:private|protected|public)\s*\[\s*\w+\s*\]\s+|(?:private|protected|public|final|sealed|abstract|implicit|lazy|override|inline)\s+)*`;
const ANNOTATION_PREFIX = String.raw`(?:@\w+(?:\([^)]*\))?(?:[ \t]+|\n[ \t]*))*`;
const GENERIC = String.raw`(?:\[[^]]*\])?`;

function skipAnnotations(src: string, from: number): number {
  let i = from;
  while (i < src.length) {
    if (src[i] !== "@") break;
    while (i < src.length && src[i] !== "\n" && src[i] !== " ") i++;
    if (src[i] === " ") {
      i++;
    } else if (src[i] === "\n") {
      i++;
      while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
    } else {
      break;
    }
  }
  return i;
}

function extractDefs(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODS}def\\s+(\\w+)${GENERIC}`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = skipAnnotations(src, m.index ?? 0);
    const text = captureDefHead(src, startIdx);
    if (text && !isInsideBlock(src, startIdx)) {
      results.push({ name, text });
    }
  }
  return results;
}

function extractClasses(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODS}(?:case\\s+|final\\s+)*class\\s+(\\w+)${GENERIC}`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = skipAnnotations(src, m.index ?? 0);
    const text = captureClassHead(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractObjects(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODS}(?:case\\s+)?object\\s+(\\w+)`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = skipAnnotations(src, m.index ?? 0);
    const text = captureClassHead(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractTraits(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODS}trait\\s+(\\w+)${GENERIC}`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = skipAnnotations(src, m.index ?? 0);
    const text = captureClassHead(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function extractTypeAliases(src: string): SignatureEntry[] {
  const results: SignatureEntry[] = [];
  const re = new RegExp(
    `^${ANNOTATION_PREFIX}${MODS}type\\s+[+\\-]?(\\w+)${GENERIC}`,
    "gm",
  );
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const startIdx = skipAnnotations(src, m.index ?? 0);
    const text = captureStatement(src, startIdx);
    if (text) results.push({ name, text });
  }
  return results;
}

function isInsideBlock(src: string, idx: number): boolean {
  let braceDepth = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const ch = src[i];
    if (ch === "}" || ch === ")" || ch === "]") braceDepth++;
    else if (ch === "{" || ch === "(" || ch === "[") {
      if (braceDepth === 0) return true;
      braceDepth--;
    }
  }
  return false;
}

function captureDefHead(src: string, startIdx: number): string | undefined {
  let i = startIdx;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let bodyAssigned = false;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "(") parenDepth++;
    else if (ch === ")") {
      if (parenDepth > 0) parenDepth--;
    } else if (ch === "[") bracketDepth++;
    else if (ch === "]") {
      if (bracketDepth > 0) bracketDepth--;
    } else if (ch === "{") {
      if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
        if (bodyAssigned) {
          return src.slice(startIdx, i).trimEnd();
        }
        braceDepth++;
      } else {
        braceDepth++;
      }
    } else if (ch === "}") {
      if (braceDepth > 0) braceDepth--;
    } else if (ch === "=" && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      const next = src[i + 1];
      if (next === ">") {
        i++;
        continue;
      }
      bodyAssigned = true;
      return src.slice(startIdx, i + 1).trimEnd();
    }
    i++;
  }
  return src.slice(startIdx).trimEnd();
}

function captureClassHead(src: string, startIdx: number): string | undefined {
  let i = startIdx;
  let braceDepth = 0;
  let parenDepth = 0;
  let angleDepth = 0;
  let bracketDepth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "{") {
      if (braceDepth === 0 && parenDepth === 0 && angleDepth === 0 && bracketDepth === 0) {
        return src.slice(startIdx, i).trimEnd();
      }
      braceDepth++;
    } else if (ch === "}") {
      if (braceDepth > 0) braceDepth--;
    } else if (ch === "(") parenDepth++;
    else if (ch === ")") {
      if (parenDepth > 0) parenDepth--;
    } else if (ch === "<") angleDepth++;
    else if (ch === ">") {
      if (angleDepth > 0) angleDepth--;
    } else if (ch === "[") bracketDepth++;
    else if (ch === "]") {
      if (bracketDepth > 0) bracketDepth--;
    } else if ((ch === "\n" || ch === ";") && braceDepth === 0 && parenDepth === 0 && angleDepth === 0 && bracketDepth === 0) {
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
