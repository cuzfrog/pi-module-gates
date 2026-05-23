import * as fs from "node:fs";
import * as path from "node:path";

export type ModuleGateConfig = {
  moduleDescriptorFileName: string;
  moduleDescriptorReadonly: boolean;
  sourceRoot: string;
};

const DEFAULTS: ModuleGateConfig = {
  moduleDescriptorFileName: "module.md",
  moduleDescriptorReadonly: true,
  sourceRoot: "src/",
};

export function loadConfig(cwd: string): ModuleGateConfig {
  const settingsPath = path.join(cwd, ".pi", "settings.json");
  let userConfig: Partial<ModuleGateConfig> = {};
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    if (settings["module-gate"] && typeof settings["module-gate"] === "object") {
      userConfig = settings["module-gate"];
    }
  } catch {
    // file doesn't exist or invalid — use defaults
  }
  return { ...DEFAULTS, ...userConfig };
}
