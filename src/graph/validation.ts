import * as path from "node:path";
import { readdir } from "node:fs/promises";
import type { ModuleIndex } from "../types.ts";
import { getChecker } from "../gates/checkers/registry.ts";
import { readFileSafe } from "../utils.ts";
import type { Dirent } from "node:fs";

type NotifyFn = (message: string, type?: "info" | "warning" | "error") => void;

export async function validateVisibleEntries(
  idx: ModuleIndex,
  cwd: string,
  notify: NotifyFn,
): Promise<void> {
  const childModules = new Set(
    idx.contracts.map((c) => c.modulePath),
  );

  for (const contract of idx.contracts) {
    if (contract.visible === null) continue;

    const exportedSymbols = await collectExports(contract.modulePath, childModules);

    for (const sig of contract.visible) {
      if (!exportedSymbols.has(sig.name)) {
        const relModule = path.relative(cwd, path.join(contract.modulePath, "module.md"));
        notify(
          `[Module Gate] Dangling visible entry "${sig.name}" in ${relModule}`,
          "warning",
        );
      }
    }
  }
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


