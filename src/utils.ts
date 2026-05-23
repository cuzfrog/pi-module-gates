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

export function parseVisibleEntry(raw: string): Signature {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { name: raw };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { name: parts[0] };
  const name = parts[parts.length - 1];
  const modifier = parts.slice(0, -1).join(" ");
  return { modifier, name };
}

export function isWithinSourceRoot(absPath: string, resolvedRoot: string): boolean {
  return absPath.startsWith(resolvedRoot + path.sep) || absPath === resolvedRoot;
}
