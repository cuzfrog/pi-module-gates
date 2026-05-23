import * as path from "node:path";
import { getChecker } from "./checkers/registry.ts";
import type { ModuleIndex, Signature } from "../types.ts";

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
  descriptorFileName: string,
): ExportCheckResult {
  const absFile = path.resolve(cwd, filePath);
  const checker = getChecker(absFile);
  if (!checker) return { blocked: false };

  const ancestors = index.contracts.filter(
    (c) => absFile.startsWith(c.modulePath + path.sep) || absFile === c.modulePath,
  );

  const constraining = ancestors.filter((c) => c.visible !== null);
  if (constraining.length === 0) return { blocked: false };

  const allowedMap = buildAllowedMap(constraining);
  const newExports = checker.getNewExports(beforeContent, afterContent);
  const violations: ExportViolation[] = [];

  for (const sig of newExports) {
    if (!allowedMap.has(sig.name)) {
      const imposer = constraining.find(
        (c) => c.visible !== null && !c.visible.some((s) => s.name === sig.name),
      );
      const imposedBy = imposer
        ? path.relative(cwd, path.join(imposer.modulePath, descriptorFileName))
        : path.relative(cwd, path.join(constraining[0].modulePath, descriptorFileName));
      violations.push({ name: sig.name, imposedBy });
      continue;
    }

    const requiredMod = allowedMap.get(sig.name);
    if (requiredMod !== undefined && sig.modifier !== requiredMod) {
      const imposer = constraining.find(
        (c) =>
          c.visible !== null &&
          c.visible.some((s) => s.name === sig.name && s.modifier === requiredMod),
      );
      const imposedBy = imposer
        ? path.relative(cwd, path.join(imposer.modulePath, descriptorFileName))
        : path.relative(cwd, path.join(constraining[0].modulePath, descriptorFileName));
      violations.push({
        name: `${sig.modifier ?? ""} ${sig.name}`.trim(),
        imposedBy,
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

function buildAllowedMap(
  constraining: { visible: Signature[] | null }[],
): Map<string, string | undefined> {
  const maps: Map<string, string | undefined>[] = [];
  for (const c of constraining) {
    if (c.visible === null) continue;
    const m = new Map<string, string | undefined>();
    for (const sig of c.visible) {
      m.set(sig.name, sig.modifier);
    }
    maps.push(m);
  }

  if (maps.length === 0) return new Map();

  const result = new Map(maps[0]);
  for (let i = 1; i < maps.length; i++) {
    const cur = maps[i];
    for (const [name, mod] of result) {
      if (!cur.has(name)) {
        result.delete(name);
        continue;
      }
      const curMod = cur.get(name);
      if (mod !== undefined && curMod !== undefined && mod !== curMod) {
        result.delete(name);
      } else if (curMod !== undefined) {
        result.set(name, curMod);
      }
    }
  }

  return result;
}
