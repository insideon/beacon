import { readFile } from "fs/promises";
import { join } from "path";
import type { Collector, CollectorResult } from "./types.js";

export interface ConfigData {
  packageJson?: {
    name: string;
    version: string;
    description?: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  hasTypescript: boolean;
  hasEslint: boolean;
  hasPrettier: boolean;
}

async function tryReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

interface PackageJsonShape {
  name?: string;
  version?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export class ConfigCollector implements Collector<ConfigData> {
  name = "config";

  async collect(projectPath: string): Promise<CollectorResult<ConfigData>> {
    const start = Date.now();

    const pkgJson = await tryReadJson<PackageJsonShape>(
      join(projectPath, "package.json")
    );

    let packageJson: ConfigData["packageJson"];
    if (pkgJson) {
      packageJson = {
        name: pkgJson.name ?? "",
        version: pkgJson.version ?? "",
        description: pkgJson.description,
        dependencies: pkgJson.dependencies ?? {},
        devDependencies: pkgJson.devDependencies ?? {},
        scripts: pkgJson.scripts ?? {},
      };
    }

    // TypeScript: tsconfig.json exists or typescript is in dependencies
    const tsconfig = await tryReadJson(join(projectPath, "tsconfig.json"));
    const hasTypescript =
      tsconfig !== null ||
      !!(
        pkgJson?.dependencies?.["typescript"] ??
        pkgJson?.devDependencies?.["typescript"]
      );

    // ESLint: .eslintrc.*, eslint.config.*, or eslint in dependencies
    const hasEslintDep =
      !!(
        pkgJson?.dependencies?.["eslint"] ??
        pkgJson?.devDependencies?.["eslint"]
      ) ||
      Object.keys(pkgJson?.devDependencies ?? {}).some((k) =>
        k.startsWith("@eslint/")
      );

    let hasEslintConfig = false;
    const eslintConfigNames = [
      ".eslintrc",
      ".eslintrc.js",
      ".eslintrc.cjs",
      ".eslintrc.json",
      ".eslintrc.yaml",
      ".eslintrc.yml",
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.cjs",
    ];
    for (const name of eslintConfigNames) {
      const result = await tryReadJson(join(projectPath, name));
      if (result !== null) {
        hasEslintConfig = true;
        break;
      }
    }
    // Also check package.json eslintConfig field
    const hasEslint =
      hasEslintDep ||
      hasEslintConfig ||
      !!(pkgJson as Record<string, unknown> | null)?.["eslintConfig"];

    // Prettier: .prettierrc*, prettier.config.*, or prettier in dependencies
    const hasPrettierDep =
      !!(
        pkgJson?.dependencies?.["prettier"] ??
        pkgJson?.devDependencies?.["prettier"]
      ) ||
      Object.keys(pkgJson?.devDependencies ?? {}).some((k) =>
        k.startsWith("eslint-config-prettier")
      );

    let hasPrettierConfig = false;
    const prettierConfigNames = [
      ".prettierrc",
      ".prettierrc.js",
      ".prettierrc.cjs",
      ".prettierrc.json",
      ".prettierrc.yaml",
      ".prettierrc.yml",
      ".prettierrc.toml",
      "prettier.config.js",
      "prettier.config.cjs",
      "prettier.config.mjs",
    ];
    for (const name of prettierConfigNames) {
      const result = await tryReadJson(join(projectPath, name));
      if (result !== null) {
        hasPrettierConfig = true;
        break;
      }
    }
    // Also check package.json prettier field
    const hasPrettier =
      hasPrettierDep ||
      hasPrettierConfig ||
      !!(pkgJson as Record<string, unknown> | null)?.["prettier"];

    return {
      source: "config",
      data: {
        packageJson,
        hasTypescript,
        hasEslint,
        hasPrettier,
      },
      metadata: {
        collectedAt: new Date(),
        duration: Date.now() - start,
      },
    };
  }
}
