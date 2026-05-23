import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";

const rustChecker: ExportChecker = {
  extensions: [".rs"],
  getNewExports(before: string, after: string): string[] {
    const beforeSet = new Set(extractPubItems(before));
    return extractPubItems(after).filter((name) => !beforeSet.has(name));
  },
};

registerChecker(rustChecker);

function extractPubItems(src: string): string[] {
  return [...src.matchAll(
    /^pub(?:\([^)]*\))?\s+(?:fn|struct|enum|trait|type|const|mod)\s+(\w+)/gm,
  )].map((m) => m[1]);
}
