import type { ModuleIndex } from "../types.ts";

export function buildSystemPromptHint(
  index: ModuleIndex,
  systemPrompt: string,
  descriptorFileName: string,
): string {
  if (index.contracts.length === 0) return systemPrompt;

  return systemPrompt + `

## Module gates (boundary enforcement)
This project uses \`${descriptorFileName}\`(case-insensitive) files to declare visibility, readonly and frozen rules that you should follow.
If you cannot comply, reconsider your design, if impossible, raise to the user with tradeoffs.
Each \`${descriptorFileName}\` gates its branching point in the tree.
A \`${descriptorFileName}\` with a \`visible\` list means only entries in the list are allowed to be visible outside the module.
\`readonly\` files are readonly; \`frozen\` files cannot grow their surface size (no new exports).
Violations will be blocked.`;
}
