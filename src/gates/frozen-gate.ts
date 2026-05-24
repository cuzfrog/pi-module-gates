import * as path from "node:path";
import type { ModuleIndex } from "../types.ts";
import { getAncestorContracts, matchesPattern } from "../utils.ts";
import { getChecker } from "./checkers/registry.ts";

export type FrozenCheckResult =
  | { blocked: true; reason: string }
  | { blocked: false };

export function checkFrozen(
  filePath: string,
  beforeContent: string,
  afterContent: string,
  index: ModuleIndex,
  cwd: string,
  descriptorFileName: string,
): FrozenCheckResult {
  const absFile = path.resolve(cwd, filePath);

  const checker = getChecker(absFile);
  if (!checker) return { blocked: false };

  const ancestors = getAncestorContracts(absFile, index);

  for (const contract of ancestors) {
    for (const pattern of contract.frozen) {
      if (matchesPattern(absFile, pattern, contract.modulePath)) {
        const newExports = checker.getNewExports(beforeContent, afterContent);
        if (newExports.length === 0) return { blocked: false };

        const relModuleMd = path.relative(cwd, path.join(contract.modulePath, descriptorFileName));
        const names = newExports.map((s) => s.name).join(", ");
        return {
          blocked: true,
          reason: `Frozen rule: file is frozen in ${relModuleMd}. Cannot add new exports: ${names}`,
        };
      }
    }
  }

  return { blocked: false };
}
