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

const files = walk(ROOT);
let count = 0;
for (const file of files) {
  if (!file.endsWith(".js")) continue;
  const src = readFileSync(file, "utf-8");
  const updated = src
    .replace(/(from\s+["']\.\.?\/[^"']+?)\.js(["'])/g, "$1.mjs$2")
    .replace(/(import\s+["']\.\.?\/[^"']+?)\.js(["'])/g, "$1.mjs$2")
    .replace(/(export\s*\*\s*from\s+["']\.\.?\/[^"']+?)\.js(["'])/g, "$1.mjs$2")
    .replace(/(import\s*\(\s*["']\.\.?\/[^"']+?)\.js(["']\s*\))/g, "$1.mjs$2");
  writeFileSync(file, updated, "utf-8");
  renameSync(file, file.replace(/\.js$/, ".mjs"));
  count++;
}
console.log(`[postbuild] renamed ${count} .js → .mjs`);