import * as path from "node:path";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { ModuleIndex } from "../types.ts";
import type { ModuleGateConfig } from "../config.ts";
import { readFileSafe, applyEdits, isWithinSourceRoot, findOwningModule } from "../utils.ts";
import {
  checkReadonly,
  checkFrozen,
  checkExports,
  checkModuleInterfaceImports,
} from "./index.ts";
import "./checkers/index.ts";

export type GateEdit = { oldText: string; newText: string };

export type GateDenial = { block: true; reason: string };

export function runGates(
  filePath: string,
  edits: GateEdit[],
  cwd: string,
  index: ModuleIndex,
  config: ModuleGateConfig,
  beforeOverride?: string,
): GateDenial | undefined {
  const absPath = path.resolve(cwd, filePath);

  const before = beforeOverride ?? readFileSafe(absPath);
  const after = applyEdits(before, edits);
  const srcRoot = path.resolve(cwd, config.sourceRoot);

  if (!isWithinSourceRoot(absPath, srcRoot)) return undefined;

  const readonlyResult = checkReadonly(filePath, index, cwd, config.moduleDescriptorFileName);
  if (readonlyResult.blocked) {
    if (
      config.moduleDescriptorReadonly === "frontmatter" &&
      isDescriptorFile(absPath, config.moduleDescriptorFileName)
    ) {
      const fmBefore = extractFrontmatter(before);
      const fmAfter = extractFrontmatter(after);
      if (JSON.stringify(fmBefore) === JSON.stringify(fmAfter)) {
        return undefined;
      }
      return {
        block: true,
        reason: formatDenial(
          filePath,
          `Readonly rule: frontmatter of ${config.moduleDescriptorFileName} is readonly`,
          absPath,
          index,
          cwd,
          config.moduleDescriptorFileName,
        ),
      };
    }
    return { block: true, reason: formatDenial(filePath, readonlyResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
  }

  const frozenResult = checkFrozen(filePath, before, after, index, cwd, config.moduleDescriptorFileName);
  if (frozenResult.blocked) {
    return { block: true, reason: formatDenial(filePath, frozenResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
  }

  const exportResult = checkExports(filePath, before, after, index, cwd, config.moduleDescriptorFileName);
  if (exportResult.blocked) {
    return { block: true, reason: formatDenial(filePath, exportResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
  }

  const importResult = checkModuleInterfaceImports(filePath, after, index, cwd, config.disableModuleInterfaceImportGate, config.sourceRoot);
  if (importResult.blocked) {
    return { block: true, reason: formatDenial(filePath, importResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
  }

  return undefined;
}

export function formatDenial(
  relPath: string,
  reason: string,
  absPath: string,
  index: ModuleIndex,
  cwd: string,
  descriptorFileName: string,
): string {
  const modulePath = findOwningModule(absPath, index);
  const contract = modulePath
    ? index.contracts.find((c) => c.modulePath === modulePath)
    : undefined;

  let message = `[Module Gate] Write blocked — ${relPath}\n\n${reason}`;

  if (contract && contract.prose) {
    const relModuleMd = path.relative(cwd, path.join(contract.modulePath, descriptorFileName));
    message += `\n\nModule contract (${relModuleMd}):\n${contract.prose}`;
  }

  return message;
}

export function isDescriptorFile(absPath: string, descriptorFileName: string): boolean {
  const basename = path.basename(absPath);
  return basename.toLowerCase() === descriptorFileName.toLowerCase();
}

export function extractFrontmatter(content: string): Record<string, unknown> {
  try {
    return parseFrontmatter(content).frontmatter;
  } catch {
    return {};
  }
}