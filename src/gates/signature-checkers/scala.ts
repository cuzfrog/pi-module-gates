import { registerChecker } from "./registry.ts";
import type { SignatureChecker } from "./registry.ts";

const scalaSignatureChecker: SignatureChecker = {
  extensions: [".scala", ".sc"],
  getSignatures(): Map<string, string> {
    return new Map();
  },
};

registerChecker(scalaSignatureChecker);