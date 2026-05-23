import type { ModuleIndex } from "../types.ts";

export function buildSystemPromptHint(
  index: ModuleIndex,
  systemPrompt: string,
  descriptorFileName: string,
): string {
  if (index.contracts.length === 0) return systemPrompt;

  return systemPrompt + `

## Module gates (boundary enforcement)
This project uses \`${descriptorFileName}\` files to declare visibility and readonly rules that you should follow.
If you cannot comply the constraints, consider your design, if impossible, raise to user with pros and cons.
Each \`${descriptorFileName}\` gates its immediate directory.
A \`${descriptorFileName}\` with a \`visible\` list means only entries in the list are allowed to be visible outside the module.
A \`${descriptorFileName}\` and its mentioned \`readonly\` files are readonly.
Violations will be blocked.`;
}
