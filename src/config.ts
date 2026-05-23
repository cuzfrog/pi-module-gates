import * as fs from "node:fs";
import * as path from "node:path";

export type ModuleGateConfig = {
  moduleDescriptorFileName: string;
  sourceRoot: string;
};

const DEFAULTS: ModuleGateConfig = {
  moduleDescriptorFileName: "module.md",
  sourceRoot: "src/",
};

export function loadConfig(cwd: string): ModuleGateConfig {
  const configPath = path.join(cwd, ".pi", "module-gate-config.json");
  let userConfig: Partial<ModuleGateConfig> = {};
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    userConfig = JSON.parse(raw);
  } catch {
    // file doesn't exist or invalid — use defaults
  }
  return { ...DEFAULTS, ...userConfig };
}
