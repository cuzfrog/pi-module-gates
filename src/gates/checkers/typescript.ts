import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const tsChecker: ExportChecker = {
  extensions: [".ts", ".tsx", ".js", ".jsx"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(extractExports(before).map((s) => s.name));
    return extractExports(after).filter((sig) => !beforeNames.has(sig.name));
  },
};

registerChecker(tsChecker);

function extractExports(src: string): Signature[] {
  return [...src.matchAll(
    /^export\s+(?:default\s+)?(?:\w+\s+)*(?:function(?:\s*\*)?|class|const|let|var|type|interface|enum)\s+(\w+)/gm,
  )].map((m) => ({ name: m[1] }));
}
