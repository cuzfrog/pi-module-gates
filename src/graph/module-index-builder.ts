import * as fs from "node:fs";
import * as path from "node:path";
import { readdir } from "node:fs/promises";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { ModuleContract, ModuleIndex } from "../types.ts";
import type { ModuleGateConfig } from "../config.ts";
import type { Dirent } from "node:fs";
import { validateVisibleEntries } from "./validation.ts";
import { parseVisibleEntry } from "../utils.ts";

type ModuleFrontmatter = {
  visible?: string[];
  readonly?: string[];
};

type IndexContext = {
  cwd: string;
  ui: { notify(message: string, type?: string): void };
};

export async function buildModuleIndex(
  ctx: IndexContext,
  config: ModuleGateConfig,
): Promise<ModuleIndex> {
  const notify = (msg: string) => ctx.ui.notify(msg, "info");
  const scanRoot = path.resolve(ctx.cwd, config.sourceRoot);

  const moduleFiles = await findModuleFiles(scanRoot, config.moduleDescriptorFileName);
  const contracts = buildContracts(moduleFiles, notify, config.moduleDescriptorFileName);
  const dirToModule = await buildDirToModuleMap(contracts);
  const index: ModuleIndex = { contracts, dirToModule };

  await validateVisibleEntries(index, ctx.cwd, ctx.ui.notify, config.moduleDescriptorFileName);

  return index;
}

function buildContracts(
  moduleFiles: string[],
  onInfo: (message: string) => void,
  descriptorFileName: string,
): ModuleContract[] {
  const contracts: ModuleContract[] = [];

  for (const absModuleFile of moduleFiles) {
    const modulePath = path.dirname(absModuleFile);
    const content = fs.readFileSync(absModuleFile, "utf-8");

    let frontmatter: ModuleFrontmatter;
    let body: string;
    try {
      const parsed = parseFrontmatter<ModuleFrontmatter>(content);
      frontmatter = parsed.frontmatter;
      body = parsed.body;
    } catch {
      onInfo(
        `[Module Gate] Failed to parse ${absModuleFile} — module will be unguarded`,
      );
      continue;
    }

    const readonlyEntries = frontmatter.readonly ?? [];
    readonlyEntries.push(descriptorFileName);

    contracts.push({
      modulePath,
      visible:
        frontmatter.visible !== undefined
          ? frontmatter.visible.map(parseVisibleEntry)
          : null,
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

async function findModuleFiles(dir: string, descriptorFileName: string): Promise<string[]> {
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
      } else if (entry.name.toLowerCase() === descriptorFileName.toLowerCase()) {
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


