import * as path from "node:path";
import { getChecker } from "./checkers/registry.ts";
import type { ModuleIndex } from "../types.ts";

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

  const ancestors = index.contracts.filter(
    (c) => absFile.startsWith(c.modulePath + path.sep) || absFile === c.modulePath,
  );

  const constraining = ancestors.filter((c) => c.visible !== null);
  if (constraining.length === 0) return { blocked: false };

  const allowedSet = buildAllowedSet(constraining);
  const newExports = checker.getNewExports(beforeContent, afterContent);
  const violations: ExportViolation[] = [];

  for (const name of newExports) {
    if (!allowedSet.has(name)) {
      const imposer = constraining.find((c) => c.visible !== null && !c.visible.includes(name));
      const imposedBy = imposer
        ? path.relative(cwd, path.join(imposer.modulePath, "module.md"))
        : path.relative(cwd, path.join(constraining[0].modulePath, "module.md"));
      violations.push({ name, imposedBy });
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

function buildAllowedSet(
  constraining: { visible: string[] | null }[],
): Set<string> {
  let allowed: Set<string> | undefined;
  for (const c of constraining) {
    if (c.visible === null) continue;
    const set = new Set(c.visible);
    if (allowed === undefined) {
      allowed = set;
    } else {
      for (const item of allowed) {
        if (!set.has(item)) allowed.delete(item);
      }
    }
  }
  return allowed ?? new Set();
}
