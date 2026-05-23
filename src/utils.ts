import * as fs from "node:fs";
import * as path from "node:path";
import type { ModuleIndex, Signature } from "./types.ts";

export function findOwningModule(
  absPath: string,
  index: ModuleIndex,
): string | undefined {
  let current = path.dirname(absPath);
  const root = path.parse(current).root;

  while (true) {
    const owner = index.dirToModule.get(current);
    if (owner !== undefined) return owner;
    if (current === root) break;
    current = path.dirname(current);
  }

  return undefined;
}

export function readFileSafe(absPath: string): string {
  try {
    return fs.readFileSync(absPath, "utf-8");
  } catch {
    return "";
  }
}

export function applyEdits(content: string, edits: { oldText: string; newText: string }[]): string {
  let result = content;
  for (const edit of edits) {
    result = result.replace(edit.oldText, edit.newText);
  }
  return result;
}

export type VisibleEntryRaw = string | { path: string; modifier?: string };

export function parseVisibleEntry(raw: VisibleEntryRaw): Signature {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return { name: extractNameFromPath(trimmed), path: trimmed };
  }
  return {
    name: extractNameFromPath(raw.path),
    modifier: raw.modifier,
    path: raw.path,
  };
}

function extractNameFromPath(pathStr: string): string {
  let p = pathStr.trim();
  if (p.endsWith("/")) p = p.slice(0, -1);
  const lastSlash = p.lastIndexOf("/");
  return lastSlash >= 0 ? p.slice(lastSlash + 1) : p;
}

export function isWithinSourceRoot(absPath: string, resolvedRoot: string): boolean {
  return absPath.startsWith(resolvedRoot + path.sep) || absPath === resolvedRoot;
}
