import * as path from "node:path";
import type { ModuleIndex } from "../types.ts";
import { getAncestorContracts, matchesPattern } from "../utils.ts";
import { getSignatureChecker } from "./signature-checkers/registry.ts";

export type SignatureCheckResult =
  | { blocked: true; reason: string }
  | { blocked: false };

export function checkSignature(
  filePath: string,
  beforeContent: string,
  afterContent: string,
  index: ModuleIndex,
  cwd: string,
  descriptorFileName: string,
): SignatureCheckResult {
  const absFile = path.resolve(cwd, filePath);

  const checker = getSignatureChecker(absFile);
  if (!checker) return { blocked: false };

  const beforeSigs = checker.getSignatures(beforeContent);
  const afterSigs = checker.getSignatures(afterContent);

  const ancestors = getAncestorContracts(absFile, index);
  const changed: { name: string; relModuleMd: string }[] = [];

  for (const contract of ancestors) {
    for (const entry of contract.signatureLock) {
      if (!matchesPattern(absFile, entry.filePath, contract.modulePath)) continue;
      const before = beforeSigs.get(entry.name);
      const after = afterSigs.get(entry.name);
      if (before === undefined && after === undefined) continue;
      if (before !== after) {
        changed.push({
          name: entry.name,
          relModuleMd: path.relative(cwd, path.join(contract.modulePath, descriptorFileName)),
        });
      }
    }
  }

  if (changed.length === 0) return { blocked: false };

  const names = changed.map((c) => c.name).join(", ");
  const modules = [...new Set(changed.map((c) => c.relModuleMd))].join(", ");
  return {
    blocked: true,
    reason: `Signature rule: signatures changed for ${names} (locked in ${modules})`,
  };
}