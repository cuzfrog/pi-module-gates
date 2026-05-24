import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const scalaChecker: ExportChecker = {
  extensions: [".scala", ".sc"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(extractExports(before).map((s) => s.name));
    return extractExports(after).filter((sig) => !beforeNames.has(sig.name));
  },
};

registerChecker(scalaChecker);

function extractExports(src: string): Signature[] {
  const re = /^(?:(private(?:\[[^\]]*\])?|protected(?:\[[^\]]*\])?)\s+)?(?:class|object|trait|def|val|var|type|given|extension)\s+(\w+)/gm;
  const results: Signature[] = [];
  for (const m of src.matchAll(re)) {
    if (m[1] === "private" || m[1] === "protected") continue;
    results.push({
      modifier: m[1] || undefined,
      name: m[2],
    });
  }
  return results;
}
