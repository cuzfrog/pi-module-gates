import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const goChecker: ExportChecker = {
  extensions: [".go"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(extractExports(before).map((s) => s.name));
    return extractExports(after).filter((sig) => !beforeNames.has(sig.name));
  },
};

registerChecker(goChecker);

function extractExports(src: string): Signature[] {
  return [...src.matchAll(
    /^(?:func\s+(?!\()|type\s+|var\s+|const\s+)([\p{Lu}]\w*)/gmu,
  )].map((m) => ({ name: m[1] }));
}
