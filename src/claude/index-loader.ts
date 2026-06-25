import type { ModuleIndex } from "../types.ts";
import type { ModuleGateConfig } from "../config.ts";
import { loadConfig } from "../config.ts";
import { buildModuleIndex } from "../graph/index.ts";

export type IndexContext = {
  cwd: string;
  ui: { notify: (msg: string) => void };
};

export type LoadIndexResult = {
  index: ModuleIndex;
  config: ModuleGateConfig;
};

export async function loadIndexForHook(cwd: string): Promise<LoadIndexResult> {
  const config = loadConfig(cwd);
  const ctx: IndexContext = {
    cwd,
    ui: {
      notify: (m) => process.stderr.write(`[Module Gate] ${m}\n`),
    },
  };

  try {
    const index = await buildModuleIndex(ctx, config);
    return { index, config };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[Module Gate] index build failed: ${message}\n`);
    return {
      index: { contracts: [], dirToModule: new Map() },
      config,
    };
  }
}

export function notifyNoContracts(ctx: IndexContext): void {
  ctx.ui.notify("No module descriptor files found. Gates are not active.");
}