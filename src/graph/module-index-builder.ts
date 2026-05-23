import * as fs from "node:fs";
import * as path from "node:path";
import { readdir } from "node:fs/promises";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { ModuleContract, ModuleIndex } from "../types.ts";
import type { Dirent } from "node:fs";

type ModuleFrontmatter = {
  visible?: string[];
  readonly?: string[];
};

export async function buildModuleIndex(cwd: string): Promise<ModuleIndex> {
  const moduleFiles = await findModuleFiles(cwd);
  const contracts = buildContracts(moduleFiles);
  const dirToModule = await buildDirToModuleMap(contracts);
  return { contracts, dirToModule };
}

function buildContracts(moduleFiles: string[]): ModuleContract[] {
  const contracts: ModuleContract[] = [];

  for (const absModuleFile of moduleFiles) {
    const modulePath = path.dirname(absModuleFile);
    const content = fs.readFileSync(absModuleFile, "utf-8");
    const { frontmatter, body } = parseFrontmatter<ModuleFrontmatter>(content);

    const readonlyEntries = frontmatter.readonly ?? [];
    readonlyEntries.push("module.md");

    contracts.push({
      modulePath,
      visible: frontmatter.visible !== undefined ? frontmatter.visible : null,
      readonly: readonlyEntries,
      prose: body.trim(),
    });
  }

  contracts.sort((a, b) => a.modulePath.length - b.modulePath.length);
  return contracts;
}

async function buildDirToModuleMap(
  contracts: ModuleContract[],
): Promise<Map<string, string>> {
  const dirToModule = new Map<string, string>();
  const sortedByDepth = [...contracts].sort(
    (a, b) => a.modulePath.length - b.modulePath.length,
  );

  for (const contract of sortedByDepth) {
    const dirs = await walkDirs(contract.modulePath);
    for (const dir of dirs) {
      dirToModule.set(dir, contract.modulePath);
    }
  }

  return dirToModule;
}

async function findModuleFiles(dir: string): Promise<string[]> {
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
        stack.push(fullPath);
      } else if (entry.name.toLowerCase() === "module.md") {
        results.push(fullPath);
      }
    }
  }

  return results;
}

async function walkDirs(root: string): Promise<string[]> {
  const results: string[] = [root];
  const stack: string[] = [root];

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
      if (entry.isDirectory()) {
        const fullPath = path.join(current, entry.name);
        results.push(fullPath);
        stack.push(fullPath);
      }
    }
  }

  return results;
}

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
