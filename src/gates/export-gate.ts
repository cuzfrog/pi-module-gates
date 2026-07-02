import * as path from "node:path";
import { getChecker } from "./checkers/registry.ts";
import type { ModuleIndex, ModuleContract } from "../types.ts";

export type ExportViolation = { name: string; imposedBy: string };

export type ExportCheckResult =
  | { blocked: true; violations: ExportViolation[]; reason: string }
  | { blocked: false };

export function checkExports(
  filePath: string,
  beforeContent: string,
  afterContent: string,
  index: ModuleIndex,
  cwd: string,
): ExportCheckResult {
  const absFile = path.resolve(cwd, filePath);
  const checker = getChecker(absFile);
  if (!checker) return { blocked: false };

  const contract = findImmediateContract(absFile, index.contracts);
  if (!contract || contract.visible === null) return { blocked: false };

  const newExports = checker.getNewExports(beforeContent, afterContent);
  const violations: ExportViolation[] = [];

  for (const sig of newExports) {
    const visibleEntry = contract.visible.find((s) => s.name === sig.name);
    if (!visibleEntry) {
      violations.push({
        name: sig.name,
        imposedBy: path.relative(cwd, path.join(contract.modulePath, contract.descriptorFileName)),
      });
      continue;
    }

    const requiredMod = visibleEntry.modifier;
    if (requiredMod !== undefined && sig.modifier !== requiredMod) {
      violations.push({
        name: `${sig.modifier ?? ""} ${sig.name}`.trim(),
        imposedBy: path.relative(cwd, path.join(contract.modulePath, contract.descriptorFileName)),
      });
      continue;
    }
  }

  if (violations.length === 0) return { blocked: false };

  const lines = violations.map(
    (v) => `  \u2022 ${v.name}  not in visible list of ${v.imposedBy}`,
  );
  return {
    blocked: true,
    violations,
    reason: `Export violations:\n${lines.join("\n")}`,
  };
}

function findImmediateContract(
  absFile: string,
  contracts: ModuleContract[],
): ModuleContract | undefined {
  let best: ModuleContract | undefined;
  for (const c of contracts) {
    if (absFile.startsWith(c.modulePath + path.sep) || absFile === c.modulePath) {
      if (!best || c.modulePath.length > best.modulePath.length) {
        best = c;
      }
    }
  }
  return best;
}
