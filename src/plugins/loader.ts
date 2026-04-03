import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { pathToFileURL } from "url";
import type { CollectorResult } from "../collectors/types.js";

export interface PluginCollector {
  name: string;
  collect(projectPath: string): Promise<CollectorResult<Record<string, unknown>>>;
}

export interface BeaconPlugin {
  name: string;
  version?: string;
  collectors?: PluginCollector[];
}

/**
 * Load plugins from .beacon/plugins/ directory.
 * Each plugin is a .js or .mjs file that exports a BeaconPlugin.
 */
export async function loadPlugins(projectPath: string): Promise<BeaconPlugin[]> {
  const pluginDir = join(projectPath, ".beacon", "plugins");
  const plugins: BeaconPlugin[] = [];

  let files: string[];
  try {
    files = await readdir(pluginDir);
  } catch {
    return []; // No plugins directory
  }

  const jsFiles = files.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));

  for (const file of jsFiles) {
    try {
      const filePath = join(pluginDir, file);
      const fileUrl = pathToFileURL(filePath).href;
      const mod = await import(fileUrl);
      const plugin: BeaconPlugin = mod.default ?? mod;

      if (plugin.name) {
        plugins.push(plugin);
      }
    } catch (err) {
      process.stderr.write(
        `[beacon] Warning: Failed to load plugin "${file}": ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  }

  return plugins;
}

/**
 * Run all plugin collectors and return their results.
 */
export async function runPluginCollectors(
  plugins: BeaconPlugin[],
  projectPath: string
): Promise<Map<string, CollectorResult<Record<string, unknown>>>> {
  const results = new Map<string, CollectorResult<Record<string, unknown>>>();

  const collectors = plugins.flatMap((p) => p.collectors ?? []);

  const settled = await Promise.allSettled(
    collectors.map(async (c) => ({
      name: c.name,
      result: await c.collect(projectPath),
    }))
  );

  for (const s of settled) {
    if (s.status === "fulfilled") {
      results.set(s.value.name, s.value.result);
    }
  }

  return results;
}
