import type { ModuleIndex } from "../types.ts";

export function buildSystemPromptHint(
  index: ModuleIndex,
  systemPrompt: string,
  descriptorFileName: string,
): string {
  if (index.contracts.length === 0) return systemPrompt;

  return systemPrompt + `

## Module descriptors
This project uses \`${descriptorFileName}\` files to declare visibility and readonly rules.
Before modifying files in any directory, check for a \`${descriptorFileName}\`.
If a \`${descriptorFileName}\` is present with a \`visible\` list, only exports in the list are allowed.
A \`${descriptorFileName}\` and its mentioned \`readonly\` files are readonly.
Violations will be blocked.`;
}
