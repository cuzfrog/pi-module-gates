import type { Signature, SignatureLockEntry } from "../types.ts";

export type VisibleEntryRaw = string | { path: string; modifier?: string };

export type ModuleFrontmatter = {
  visible?: VisibleEntryRaw[];
  readonly?: string[];
  sealed?: string[];
  signatureLock?: string[];
};

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

export function parseSignatureLockEntry(raw: string): SignatureLockEntry {
  const trimmed = raw.trim();
  const sep = trimmed.indexOf("$");
  if (sep < 0) {
    throw new Error(`signature-lock entry "${raw}" is missing the "$" separator`);
  }
  let filePath = trimmed.slice(0, sep).trim();
  const name = trimmed.slice(sep + 1).trim();
  if (filePath.startsWith("./")) filePath = filePath.slice(2);
  if (!filePath || !name) {
    throw new Error(`signature-lock entry "${raw}" must have non-empty filePath and name`);
  }
  return { filePath, name };
}

function extractNameFromPath(pathStr: string): string {
  let p = pathStr.trim();
  if (p.endsWith("/")) p = p.slice(0, -1);
  const lastSlash = p.lastIndexOf("/");
  return lastSlash >= 0 ? p.slice(lastSlash + 1) : p;
}