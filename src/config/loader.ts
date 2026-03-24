import { readFile } from "fs/promises";
import { join } from "path";
import type { BeaconConfig, LLMConfig, AnalyzeConfig } from "./types.js";

export type { BeaconConfig };

const DEFAULT_CONFIG: BeaconConfig = {
  llm: {
    provider: "claude",
    model: "claude-sonnet-4-6",
  },
  analyze: {
    include: ["**/*"],
    exclude: ["node_modules", "dist", ".git", "build", "coverage"],
    maxDepth: 5,
  },
};

/**
 * Resolve $ENV_VAR references in a string value.
 * If the value starts with $, treat the rest as an env var name.
 * If the env var is not set, return the original string.
 */
function resolveEnvVar(value: string): string {
  if (typeof value === "string" && value.startsWith("$")) {
    const envVarName = value.slice(1);
    const envValue = process.env[envVarName];
    return envValue !== undefined ? envValue : value;
  }
  return value;
}

/**
 * Recursively resolve $ENV_VAR references in all string values of an object.
 */
function resolveEnvVars<T>(obj: T): T {
  if (typeof obj === "string") {
    return resolveEnvVar(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVars) as unknown as T;
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = resolveEnvVars(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * Deep merge two objects, with userConfig taking priority over defaults.
 * Arrays from userConfig completely replace default arrays (no concat).
 */
function mergeConfig(defaults: BeaconConfig, userConfig: Partial<BeaconConfig>): BeaconConfig {
  const llm: LLMConfig = {
    ...defaults.llm,
    ...(userConfig.llm ?? {}),
  };

  const analyze: AnalyzeConfig = {
    ...defaults.analyze,
    ...(userConfig.analyze ?? {}),
  };

  return { llm, analyze };
}

/**
 * Load beacon configuration from .beaconrc.json in the given project path.
 * If no config file is found, returns sensible defaults.
 * Partial configs are merged with defaults.
 * $ENV_VAR references in string values are resolved.
 */
export async function loadConfig(projectPath: string): Promise<BeaconConfig> {
  const configPath = join(projectPath, ".beaconrc.json");

  let userConfig: Partial<BeaconConfig> = {};

  try {
    const content = await readFile(configPath, "utf-8");
    userConfig = JSON.parse(content) as Partial<BeaconConfig>;
  } catch {
    // No config file found or invalid JSON — use defaults
    return { ...DEFAULT_CONFIG };
  }

  const merged = mergeConfig(DEFAULT_CONFIG, userConfig);
  return resolveEnvVars(merged);
}
