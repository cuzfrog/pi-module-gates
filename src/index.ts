import * as path from "node:path";
import type {
  ExtensionAPI,
  ToolCallEventResult,
  BeforeAgentStartEventResult,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { ModuleIndex } from "./types.ts";
import { loadConfig } from "./config.ts";
import type { ModuleGateConfig } from "./config.ts";
import { buildModuleIndex } from "./graph/index.ts";
import { findOwningModule, readFileSafe, applyEdits, isWithinSourceRoot } from "./utils.ts";
import {
  checkReadonly,
  checkExports,
  checkFrozen,
  checkModuleInterfaceImports,
} from "./gates/index.ts";
import { buildSystemPromptHint } from "./context/index.ts";
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
      systemPrompt: buildSystemPromptHint(index, event.systemPrompt, config.moduleDescriptorFileName, config),
    };
  });

  pi.on("tool_call", async (event, ctx): Promise<ToolCallEventResult | void> => {
    if (isToolCallEventType("edit", event)) {
      return handleEdit(event.input.path, event.input.edits, ctx.cwd, index, config);
    }
    if (isToolCallEventType("write", event)) {
      const absPath = path.resolve(ctx.cwd, event.input.path);
      const before = readFileSafe(absPath);
      return handleEdit(event.input.path, [{ oldText: before, newText: event.input.content }], ctx.cwd, index, config);
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

  const before = readFileSafe(absPath);
  const after = applyEdits(before, edits);
  const srcRoot = path.resolve(cwd, config.sourceRoot);

  if (!isWithinSourceRoot(absPath, srcRoot)) return undefined;

  const readonlyResult = checkReadonly(filePath, index, cwd, config.moduleDescriptorFileName);
  if (readonlyResult.blocked) {
    if (
      config.moduleDescriptorReadonly === "frontmatter" &&
      isDescriptorFile(absPath, config.moduleDescriptorFileName)
    ) {
      const fmBefore = extractFrontmatter(before);
      const fmAfter = extractFrontmatter(after);
      if (JSON.stringify(fmBefore) === JSON.stringify(fmAfter)) {
        return undefined;
      }
      return {
        block: true,
        reason: formatDenial(
          filePath,
          `Readonly rule: frontmatter of ${config.moduleDescriptorFileName} is readonly`,
          absPath,
          index,
          cwd,
          config.moduleDescriptorFileName,
        ),
      };
    }
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

  const importResult = checkModuleInterfaceImports(filePath, after, index, cwd, config.disableModuleInterfaceImportGate, config.sourceRoot);
  if (importResult.blocked) {
    return { block: true, reason: formatDenial(filePath, importResult.reason, absPath, index, cwd, config.moduleDescriptorFileName) };
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

function isDescriptorFile(absPath: string, descriptorFileName: string): boolean {
  const basename = path.basename(absPath);
  return basename.toLowerCase() === descriptorFileName.toLowerCase();
}

function extractFrontmatter(content: string): Record<string, unknown> {
  try {
    return parseFrontmatter(content).frontmatter;
  } catch {
    return {};
  }
}
