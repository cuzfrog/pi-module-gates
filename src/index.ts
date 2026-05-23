import * as path from "node:path";
import type {
  ExtensionAPI,
  ToolCallEventResult,
  BeforeAgentStartEventResult,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { ModuleIndex } from "./types.ts";
import { loadConfig } from "./config.ts";
import type { ModuleGateConfig } from "./config.ts";
import { buildModuleIndex } from "./graph/module-index-builder.ts";
import { findOwningModule, readFileSafe, applyEdits } from "./utils.ts";
import { checkReadonly } from "./gates/readonly-gate.ts";
import { checkExports } from "./gates/export-gate.ts";
import { buildSystemPromptHint } from "./context/system-prompt.ts";
import "./gates/checkers/index.ts";

export default function (pi: ExtensionAPI): void {
  let index: ModuleIndex = { contracts: [], dirToModule: new Map() };
  let config: ModuleGateConfig = {
    moduleDescriptorFileName: "module.md",
    sourceRoot: "src/",
  };

  pi.on("session_start", async (_event, ctx) => {
    config = loadConfig(ctx.cwd);
    index = await buildModuleIndex(ctx, config);
    if (index.contracts.length === 0) {
      ctx.ui.notify(
        "[Module Gate] No module descriptor files found. Gates are not active.",
        "info",
      );
    }
  });

  pi.on("before_agent_start", async (event): Promise<BeforeAgentStartEventResult | void> => {
    if (index.contracts.length === 0) return;
    return {
      systemPrompt: buildSystemPromptHint(index, event.systemPrompt, config.moduleDescriptorFileName),
    };
  });

  pi.on("tool_call", async (event, ctx): Promise<ToolCallEventResult | void> => {
    if (isToolCallEventType("edit", event)) {
      return handleEdit(event.input.path, event.input.edits, ctx.cwd, index, config);
    }
    if (isToolCallEventType("write", event)) {
      return handleWrite(event.input.path, event.input.content, ctx.cwd, index, config);
    }
  });
}

function isWithinSourceRoot(absPath: string, resolvedRoot: string): boolean {
  return absPath.startsWith(resolvedRoot + path.sep) || absPath === resolvedRoot;
}

function handleEdit(
  filePath: string,
  edits: { oldText: string; newText: string }[],
  cwd: string,
  index: ModuleIndex,
  config: ModuleGateConfig,
): ToolCallEventResult | undefined {
  const absPath = path.resolve(cwd, filePath);
  const resolvedRoot = path.resolve(cwd, config.sourceRoot);

  if (!isWithinSourceRoot(absPath, resolvedRoot)) return undefined;

  const readonlyResult = checkReadonly(filePath, index, cwd, config.moduleDescriptorFileName);
  if (readonlyResult.blocked) {
    return { block: true, reason: formatDenial(filePath, readonlyResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
  }

  const before = readFileSafe(absPath);
  const after = applyEdits(before, edits);

  const exportResult = checkExports(filePath, before, after, index, cwd, config.moduleDescriptorFileName);
  if (exportResult.blocked) {
    return { block: true, reason: formatDenial(filePath, exportResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
  }

  return undefined;
}

function handleWrite(
  filePath: string,
  content: string,
  cwd: string,
  index: ModuleIndex,
  config: ModuleGateConfig,
): ToolCallEventResult | undefined {
  const absPath = path.resolve(cwd, filePath);
  const resolvedRoot = path.resolve(cwd, config.sourceRoot);

  if (!isWithinSourceRoot(absPath, resolvedRoot)) return undefined;

  const readonlyResult = checkReadonly(filePath, index, cwd, config.moduleDescriptorFileName);
  if (readonlyResult.blocked) {
    return { block: true, reason: formatDenial(filePath, readonlyResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
  }

  const before = readFileSafe(absPath);

  const exportResult = checkExports(filePath, before, content, index, cwd, config.moduleDescriptorFileName);
  if (exportResult.blocked) {
    return { block: true, reason: formatDenial(filePath, exportResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
  }

  return undefined;
}

function formatDenial(
  relPath: string,
  reason: string,
  absPath: string,
  index: ModuleIndex,
  cwd: string,
  descriptorFileName: string,
): string {
  const modulePath = findOwningModule(absPath, index);
  const contract = modulePath
    ? index.contracts.find((c) => c.modulePath === modulePath)
    : undefined;

  let message = `[Module Gate] Write blocked — ${relPath}\n\n${reason}`;

  if (contract && contract.prose) {
    const relModuleMd = path.relative(cwd, path.join(contract.modulePath, descriptorFileName));
    message += `\n\nModule contract (${relModuleMd}):\n${contract.prose}`;
  }

  return message;
}
