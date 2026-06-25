#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "dist";

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function rewriteImportStrings(src) {
  let out = "";
  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let quote = "";
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      out += ch;
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      out += ch;
      if (ch === "*" && next === "/") { out += next; i += 2; inBlockComment = false; continue; }
      i++;
      continue;
    }
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < src.length) { out += next; i += 2; continue; }
      if (ch === quote) quote = "";
      i++;
      continue;
    }
    if (ch === "/" && next === "/") { inLineComment = true; out += ch; i++; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; out += ch + next; i += 2; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; out += ch; i++; continue; }
    const rest = src.slice(i);
    const m = rest.match(/^(from\s+|import\s+|import\s*\(\s*|export\s*\*\s*from\s+)(["']\.\.?\/[^"']+?)\.js(["'])/);
    if (m) {
      out += m[1] + m[2] + ".mjs" + m[3];
      i += m[0].length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

const files = walk(ROOT);
let count = 0;
for (const file of files) {
  if (!file.endsWith(".js")) continue;
  const src = readFileSync(file, "utf-8");
  const updated = rewriteImportStrings(src);
  writeFileSync(file, updated, "utf-8");
  renameSync(file, file.replace(/\.js$/, ".mjs"));
  count++;
}
console.log(`[postbuild] renamed ${count} .js → .mjs`);
