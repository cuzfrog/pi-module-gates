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
import { findOwningModule, readFileSafe, applyEdits, isWithinSourceRoot } from "./utils.ts";
import { checkReadonly } from "./gates/readonly-gate.ts";
import { checkExports } from "./gates/export-gate.ts";
import { checkFrozen } from "./gates/frozen-gate.ts";
import { buildSystemPromptHint } from "./context/system-prompt.ts";
import "./gates/checkers/index.ts";

export default function (pi: ExtensionAPI): void {
  let index: ModuleIndex;
  let config: ModuleGateConfig;

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
      systemPrompt: buildSystemPromptHint(index, event.systemPrompt, config.moduleDescriptorFileName, config.moduleDescriptorReadonly),
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

function handleEdit(
  filePath: string,
  edits: { oldText: string; newText: string }[],
  cwd: string,
  index: ModuleIndex,
  config: ModuleGateConfig,
): ToolCallEventResult | undefined {
  const absPath = path.resolve(cwd, filePath);
  if (!isWithinSourceRoot(absPath, path.resolve(cwd, config.sourceRoot))) return undefined;

  const before = readFileSafe(absPath);
  const after = applyEdits(before, edits);

  return checkFileWrite(filePath, before, after, cwd, index, config);
}

function handleWrite(
  filePath: string,
  content: string,
  cwd: string,
  index: ModuleIndex,
  config: ModuleGateConfig,
): ToolCallEventResult | undefined {
  const absPath = path.resolve(cwd, filePath);
  if (!isWithinSourceRoot(absPath, path.resolve(cwd, config.sourceRoot))) return undefined;

  const before = readFileSafe(absPath);

  return checkFileWrite(filePath, before, content, cwd, index, config);
}

function checkFileWrite(
  filePath: string,
  before: string,
  after: string,
  cwd: string,
  index: ModuleIndex,
  config: ModuleGateConfig,
): ToolCallEventResult | undefined {
  const absPath = path.resolve(cwd, filePath);

  const readonlyResult = checkReadonly(filePath, index, cwd, config.moduleDescriptorFileName);
  if (readonlyResult.blocked) {
    return { block: true, reason: formatDenial(filePath, readonlyResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
  }

  const frozenResult = checkFrozen(filePath, before, after, index, cwd, config.moduleDescriptorFileName);
  if (frozenResult.blocked) {
    return { block: true, reason: formatDenial(filePath, frozenResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
  }

  const exportResult = checkExports(filePath, before, after, index, cwd, config.moduleDescriptorFileName);
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
