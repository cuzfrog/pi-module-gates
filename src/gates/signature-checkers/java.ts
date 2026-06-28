import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const javaSignatureChecker: SignatureChecker = {
  extensions: [".java"],
  getSignatures(): Map<string, string> {
    return new Map();
  },
};

registerChecker(javaSignatureChecker);