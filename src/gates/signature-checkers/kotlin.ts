import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const kotlinSignatureChecker: SignatureChecker = {
  extensions: [".kt", ".kts"],
  getSignatures(): Map<string, string> {
    return new Map();
  },
};

registerChecker(kotlinSignatureChecker);