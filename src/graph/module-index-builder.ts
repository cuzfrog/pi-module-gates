import * as fs from "node:fs";
import * as path from "node:path";
import { readdir } from "node:fs/promises";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { ModuleContract, ModuleIndex } from "../types.ts";

type ModuleFrontmatter = {
  visible?: string[];
  readonly?: string[];
};

export async function buildModuleIndex(cwd: string): Promise<ModuleIndex> {
  const moduleFiles = await findModuleFiles(cwd);
  const contracts = buildContracts(moduleFiles);
  const fileToModule = await buildFileToModuleMap(contracts);
  return { contracts, fileToModule };
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

async function buildFileToModuleMap(
  contracts: ModuleContract[],
): Promise<Map<string, string>> {
  const fileToModule = new Map<string, string>();
  const sortedByDepth = [...contracts].sort(
    (a, b) => a.modulePath.length - b.modulePath.length,
  );

  for (const contract of sortedByDepth) {
    const files = await walkDir(contract.modulePath);
    for (const file of files) {
      fileToModule.set(file, contract.modulePath);
    }
  }

  return fileToModule;
}

async function findModuleFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  await walkForModuleFiles(dir, results);
  return results;
}

async function walkForModuleFiles(dir: string, results: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkForModuleFiles(fullPath, results);
    } else if (entry.name === "module.md") {
      results.push(fullPath);
    }
  }
}

async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = [];
  await walkDirRecursive(dir, results);
  return results;
}

async function walkDirRecursive(dir: string, results: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDirRecursive(fullPath, results);
    } else {
      results.push(fullPath);
    }
  }
}
