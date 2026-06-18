import * as path from "node:path";
import { readdir } from "node:fs/promises";
import type { ModuleIndex } from "../types.ts";
import { getChecker } from "../gates/checkers/index.ts";
import { readFileSafe } from "../utils.ts";
import type { Dirent } from "node:fs";

type NotifyFn = (message: string, type?: "info" | "warning" | "error") => void;

export async function validateVisibleEntries(
  idx: ModuleIndex,
  cwd: string,
  notify: NotifyFn,
  descriptorFileName: string,
): Promise<void> {
  const childModules = new Set(
    idx.contracts.map((c) => c.modulePath),
  );

  for (const contract of idx.contracts) {
    if (contract.visible === null) continue;

    const exportedSymbols = await collectExports(contract.modulePath, childModules);
    // Cache for non-local path resolution
    const pathExportsCache = new Map<string, Set<string>>();

    for (const sig of contract.visible) {
      const targetDir = resolveValidationTarget(contract.modulePath, sig.path);
      const symbols =
        targetDir !== contract.modulePath
          ? await resolvePathExports(targetDir, pathExportsCache, childModules)
          : exportedSymbols;

      if (!symbols.has(sig.name)) {
        const relModule = path.relative(cwd, path.join(contract.modulePath, descriptorFileName));
        notify(
          `[Module Gate] Dangling visible entry "${sig.name}" in ${relModule}`,
          "info",
        );
      }
    }
  }
}

function resolveValidationTarget(modulePath: string, entryPath?: string): string {
  if (!entryPath) return modulePath;
  const lastSlash = entryPath.lastIndexOf("/");
  if (lastSlash < 0) return modulePath;
  const dirPart = entryPath.slice(0, lastSlash + 1);
  const joined = path.join(modulePath, dirPart);
  return joined.endsWith(path.sep) ? joined.slice(0, -1) : joined;
}

async function collectExports(
  modulePath: string,
  childModules: Set<string>,
): Promise<Set<string>> {
  const files = await listFiles(modulePath, childModules);
  const symbols = new Set<string>();
  for (const filePath of files) {
    const checker = getChecker(filePath);
    if (!checker) continue;
    const content = readFileSafe(filePath);
    const exports = checker.getNewExports("", content);
    for (const sig of exports) {
      symbols.add(sig.name);
    }
  }
  return symbols;
}

async function resolvePathExports(
  targetDir: string,
  cache: Map<string, Set<string>>,
  childModules: Set<string>,
): Promise<Set<string>> {
  let symbols = cache.get(targetDir);
  if (!symbols) {
    symbols = await collectExports(targetDir, childModules);
    cache.set(targetDir, symbols);
  }
  return symbols;
}

async function listFiles(
  dir: string,
  childModules: Set<string>,
): Promise<string[]> {
  const results: string[] = [];
  const stack: string[] = [dir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (childModules.has(fullPath) && fullPath !== dir) continue;
        stack.push(fullPath);
      } else {
        results.push(fullPath);
      }
    }
  }

  return results;
}


