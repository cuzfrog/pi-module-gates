import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const kotlinChecker: ExportChecker = {
  extensions: [".kt", ".kts"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(extractExports(before).map((s) => s.name));
    return extractExports(after).filter((sig) => !beforeNames.has(sig.name));
  },
};

registerChecker(kotlinChecker);

function extractExports(src: string): Signature[] {
  const re = /^(?:(public|internal|protected|private)\s+)?(?:(?:data|sealed|enum|abstract|open)\s+)?(?:class|interface|object|fun|val|var|typealias)\s+(\w+)/gm;
  const results: Signature[] = [];
  for (const m of src.matchAll(re)) {
    if (m[1] === "private") continue;
    results.push({
      modifier: m[1] || undefined,
      name: m[2],
    });
  }
  return results;
}
