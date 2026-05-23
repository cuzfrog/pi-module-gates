import type { ModuleIndex } from "../types.ts";

export function buildSystemPromptHint(
  index: ModuleIndex,
  systemPrompt: string,
): string {
  if (index.contracts.length === 0) return systemPrompt;

  return systemPrompt + `

## Module descriptors
This project uses \`module.md\` files to declare visibility and readonly rules.
Before modifying files in any directory, check for a \`module.md\`.
If a \`module.md\` is present with a \`visible\` list, only exports in the list are allowed.
A \`module.md\` and its mentioned \`readonly\` files are readonly.
Violations will be blocked.`;
}
