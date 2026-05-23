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
Each \`${descriptorFileName}\` gates its immediate directory.
The \`visible\` list supports path-based entries like \`sub/Type\` to expose types from subdirectories,
and object form \`{ path: "sub/Type", modifier: "pub" }\` for modifier constraints.
If a \`${descriptorFileName}\` is present with a \`visible\` list, only exports in the list are allowed.
A \`${descriptorFileName}\` and its mentioned \`readonly\` files are readonly.
Violations will be blocked.`;
}
