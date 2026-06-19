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
  const results: Signature[] = [
    ...src.matchAll(
      /^export\s+(?:default\s+)?(?:\w+\s+)*(?:function(?:\s*\*)?|class|const|let|var|type|interface|enum)\s+(\w+)/gm,
    ),
  ].map((m) => ({ name: m[1] }));

  for (const m of src.matchAll(
    /^export\s*(?:type\s+)?\{\s*([^}]+)\s*\}\s*from/gm,
  )) {
    const inner = m[1];
    for (const entry of inner.split(",")) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const asMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/);
      if (asMatch) {
        results.push({ name: asMatch[2] });
      } else {
        results.push({ name: trimmed });
      }
    }
  }

  for (const m of src.matchAll(/^export\s*\*\s*as\s+(\w+)\s+from/gm)) {
    results.push({ name: m[1] });
  }

  for (const m of src.matchAll(/^export\s*\*\s+from/gm)) {
    results.push({ name: "*" });
  }

  for (const m of src.matchAll(
    /^export\s+default\s+(?!function|class|const|let|var|type|interface|enum|abstract|async|declare)([a-zA-Z_]\w*)/gm,
  )) {
    results.push({ name: m[1] });
  }

  return results;
}
