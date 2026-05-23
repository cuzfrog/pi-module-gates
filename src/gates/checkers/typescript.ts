import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";

const tsChecker: ExportChecker = {
  extensions: [".ts", ".tsx", ".js", ".jsx"],
  getNewExports(before: string, after: string): string[] {
    const beforeSet = new Set(extractExports(before));
    return extractExports(after).filter((name) => !beforeSet.has(name));
  },
};

registerChecker(tsChecker);

function extractExports(src: string): string[] {
  return [...src.matchAll(
    /^export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/gm,
  )].map((m) => m[1]);
}
