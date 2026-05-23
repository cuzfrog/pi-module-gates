import * as path from "node:path";
import type { ModuleIndex } from "../types.ts";

export type ReadonlyCheckResult =
  | { blocked: true; reason: string }
  | { blocked: false };

export function checkReadonly(
  filePath: string,
  index: ModuleIndex,
  cwd: string,
  descriptorFileName: string,
): ReadonlyCheckResult {
  const absFile = path.resolve(cwd, filePath);
  const ancestors = getAncestorContracts(absFile, index);

  for (const contract of ancestors) {
    for (const pattern of contract.readonly) {
      if (matchesReadonlyPattern(absFile, pattern, contract.modulePath)) {
        const relModuleMd = path.relative(cwd, path.join(contract.modulePath, descriptorFileName));
        return {
          blocked: true,
          reason: `Readonly rule: file is listed as readonly in ${relModuleMd}`,
        };
      }
    }
  }

  return { blocked: false };
}

function getAncestorContracts(absFile: string, index: ModuleIndex) {
  return index.contracts.filter((c) => absFile.startsWith(c.modulePath + path.sep) || absFile === c.modulePath);
}

function matchesReadonlyPattern(
  absFile: string,
  pattern: string,
  modulePath: string,
): boolean {
  const resolved = path.resolve(modulePath, pattern);

  if (pattern.endsWith("*")) {
    const prefix = path.resolve(modulePath, pattern.slice(0, -1));
    return absFile.startsWith(prefix);
  }

  if (absFile === resolved) return true;

  if (absFile.startsWith(resolved + path.sep)) return true;

  return false;
}
