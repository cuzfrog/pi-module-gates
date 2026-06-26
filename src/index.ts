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
import { buildModuleIndex } from "./graph/index.ts";
import { readFileSafe } from "./utils.ts";
import { runGates, type GateEdit } from "./gates/run-gates.ts";
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
      return runGates(event.input.path, event.input.edits, ctx.cwd, index, config);
    }
    if (isToolCallEventType("write", event)) {
      const absPath = path.resolve(ctx.cwd, event.input.path);
      const before = readFileSafe(absPath);
      const edits: GateEdit[] = [{ oldText: before, newText: event.input.content }];
      return runGates(event.input.path, edits, ctx.cwd, index, config);
    }
  });
}