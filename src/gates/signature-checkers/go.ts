import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const goSignatureChecker: SignatureChecker = {
  extensions: [".go"],
  getSignatures(): Map<string, string> {
    return new Map();
  },
};

registerChecker(goSignatureChecker);