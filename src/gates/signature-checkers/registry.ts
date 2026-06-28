// Signature checkers are intentionally different from ExportChecker:
// they expose a single getSignatures(src) method that returns a name->text
// map of locked signatures, and the gate (not the checker) performs the
// before/after diff. This keeps the contract "raw text equality" and lets
// the gate reason about all checkers uniformly.

import * as path from "node:path";

export interface SignatureChecker {
  extensions: string[];
  getSignatures(src: string): Map<string, string>;
}

const checkerRegistry = new Map<string, SignatureChecker>();

export function registerChecker(checker: SignatureChecker): void {
  for (const ext of checker.extensions) {
    checkerRegistry.set(ext, checker);
  }
}

export function getSignatureChecker(filePath: string): SignatureChecker | undefined {
  return checkerRegistry.get(path.extname(filePath));
}