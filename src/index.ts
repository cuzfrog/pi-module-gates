import * as fs from "node:fs";
import * as path from "node:path";
import type {
  ExtensionAPI,
  ToolCallEventResult,
  BeforeAgentStartEventResult,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { ModuleIndex } from "./types.ts";
import { buildModuleIndex } from "./graph/module-index-builder.ts";
import { checkReadonly } from "./gates/readonly-gate.ts";
import { checkExports } from "./gates/export-gate.ts";
import { getChecker } from "./gates/checkers/registry.ts";
import { buildSystemPromptHint } from "./context/system-prompt.ts";
import "./gates/checkers/typescript.ts";
import "./gates/checkers/rust.ts";

export default function (pi: ExtensionAPI): void {
  let index: ModuleIndex = { contracts: [], fileToModule: new Map() };

  pi.on("session_start", async (_event, ctx) => {
    index = await buildModuleIndex(ctx.cwd);
    validateVisibleEntries(index, ctx);
  });

  pi.on("before_agent_start", async (event): Promise<BeforeAgentStartEventResult | void> => {
    if (index.contracts.length === 0) return;
    return {
      systemPrompt: buildSystemPromptHint(index, event.systemPrompt),
    };
  });

  pi.on("tool_call", async (event, ctx): Promise<ToolCallEventResult | void> => {
    if (isToolCallEventType("edit", event)) {
      return handleEdit(event.input.path, event.input.edits, ctx.cwd, index);
    }
    if (isToolCallEventType("write", event)) {
      return handleWrite(event.input.path, event.input.content, ctx.cwd, index);
    }
  });
}

function handleEdit(
  filePath: string,
  edits: { oldText: string; newText: string }[],
  cwd: string,
  index: ModuleIndex,
): ToolCallEventResult | undefined {
  const absPath = path.resolve(cwd, filePath);

  const readonlyResult = checkReadonly(filePath, index, cwd);
  if (readonlyResult.blocked) {
    return { block: true, reason: formatDenial(filePath, readonlyResult.reason, absPath, index, cwd) };
  }

  const before = readFileSafe(absPath);
  const after = applyEdits(before, edits);

  const exportResult = checkExports(filePath, before, after, index, cwd);
  if (exportResult.blocked) {
    return { block: true, reason: formatDenial(filePath, exportResult.reason, absPath, index, cwd) };
  }

  return undefined;
}

function handleWrite(
  filePath: string,
  content: string,
  cwd: string,
  index: ModuleIndex,
): ToolCallEventResult | undefined {
  const absPath = path.resolve(cwd, filePath);

  const readonlyResult = checkReadonly(filePath, index, cwd);
  if (readonlyResult.blocked) {
    return { block: true, reason: formatDenial(filePath, readonlyResult.reason, absPath, index, cwd) };
  }

  const before = readFileSafe(absPath);

  const exportResult = checkExports(filePath, before, content, index, cwd);
  if (exportResult.blocked) {
    return { block: true, reason: formatDenial(filePath, exportResult.reason, absPath, index, cwd) };
  }

  return undefined;
}

function validateVisibleEntries(idx: ModuleIndex, ctx: ExtensionContext): void {
  for (const contract of idx.contracts) {
    if (contract.visible === null) continue;
    const moduleFiles = [...idx.fileToModule.entries()]
      .filter(([, modPath]) => modPath === contract.modulePath)
      .map(([filePath]) => filePath);

    const exportedSymbols = new Set<string>();
    for (const filePath of moduleFiles) {
      const checker = getChecker(filePath);
      if (!checker) continue;
      const content = readFileSafe(filePath);
      const exports = checker.getNewExports("", content);
      for (const name of exports) {
        exportedSymbols.add(name);
      }
    }

    for (const entry of contract.visible) {
      if (!exportedSymbols.has(entry)) {
        const relModule = path.relative(ctx.cwd, path.join(contract.modulePath, "module.md"));
        ctx.ui.notify(
          `[Module Gate] Dangling visible entry "${entry}" in ${relModule}`,
          "warning",
        );
      }
    }
  }
}

function formatDenial(
  relPath: string,
  reason: string,
  absPath: string,
  index: ModuleIndex,
  cwd: string,
): string {
  const modulePath = index.fileToModule.get(absPath);
  const contract = modulePath
    ? index.contracts.find((c) => c.modulePath === modulePath)
    : undefined;

  let message = `[Module Gate] Write blocked — ${relPath}\n\n${reason}`;

  if (contract && contract.prose) {
    const relModuleMd = path.relative(cwd, path.join(contract.modulePath, "module.md"));
    message += `\n\nModule contract (${relModuleMd}):\n${contract.prose}`;
  }

  return message;
}

function readFileSafe(absPath: string): string {
  try {
    return fs.readFileSync(absPath, "utf-8");
  } catch {
    return "";
  }
}

function applyEdits(content: string, edits: { oldText: string; newText: string }[]): string {
  let result = content;
  for (const edit of edits) {
    result = result.replace(edit.oldText, edit.newText);
  }
  return result;
}
