import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const rustChecker: ExportChecker = {
  extensions: [".rs"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(extractPubItems(before).map((s) => s.name));
    return extractPubItems(after).filter((sig) => !beforeNames.has(sig.name));
  },
};

registerChecker(rustChecker);

function extractPubItems(src: string): Signature[] {
  return [...src.matchAll(
    /^(pub(?:\([^)]*\))?)\s+(?:fn|struct|enum|trait|type|const|mod)\s+(\w+)/gm,
  )].map((m) => ({ modifier: m[1], name: m[2] }));
}
