import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const rustSignatureChecker: SignatureChecker = {
  extensions: [".rs"],
  getSignatures(): Map<string, string> {
    return new Map();
  },
};

registerChecker(rustSignatureChecker);