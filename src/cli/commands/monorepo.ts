import chalk from "chalk";
import { loadConfig, resolveApiKey } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { createSpinner } from "../spinner.js";
import { handleCliError } from "../errors.js";
import { buildSnapshot, getCurrentBranch } from "../../history/store.js";
import { calculateHealthScore } from "../../history/score.js";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { glob } from "glob";
import type { AnalysisResult } from "../../analyzer/types.js";

interface PackageInfo {
  name: string;
  path: string;
  version?: string;
}

function getHeadCommit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

async function detectPackages(projectPath: string): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];

  // Check for workspaces in root package.json
  const rootPkgPath = join(projectPath, "package.json");
  if (existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
      const workspaces: string[] = Array.isArray(rootPkg.workspaces)
        ? rootPkg.workspaces
        : rootPkg.workspaces?.packages ?? [];

      for (const pattern of workspaces) {
        const dirs = await glob(pattern, { cwd: projectPath });
        for (const dir of dirs) {
          const pkgJsonPath = join(projectPath, dir, "package.json");
          if (existsSync(pkgJsonPath)) {
            try {
              const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
              packages.push({
                name: pkg.name ?? basename(dir),
                path: join(projectPath, dir),
                version: pkg.version,
              });
            } catch {
              // skip invalid package.json
            }
          }
        }
      }
    } catch {
      // skip
    }
  }

  // Fallback: check common monorepo patterns
  if (packages.length === 0) {
    const patterns = ["packages/*", "apps/*", "libs/*", "modules/*"];
    for (const pattern of patterns) {
      const dirs = await glob(pattern, { cwd: projectPath });
      for (const dir of dirs) {
        const pkgJsonPath = join(projectPath, dir, "package.json");
        if (existsSync(pkgJsonPath)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
            packages.push({
              name: pkg.name ?? basename(dir),
              path: join(projectPath, dir),
              version: pkg.version,
            });
          } catch {
            // skip
          }
        }
      }
    }
  }

  return packages;
}

export async function monorepoCommand(options: {
  json?: boolean;
  verbose?: boolean;
}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = options.verbose ?? false;
  const isJson = options.json ?? false;
  const log = (msg: string) => {
    if (verbose) console.error(`[verbose] ${msg}`);
  };

  try {
    const packages = await detectPackages(projectPath);

    if (packages.length === 0) {
      console.log("No packages detected. This doesn't appear to be a monorepo.");
      console.log("Looked for: workspaces in package.json, packages/*, apps/*, libs/*, modules/*");
      return;
    }

    const config = await loadConfig(projectPath);
    const apiKey = await resolveApiKey(config.llm.provider, config.llm.apiKey);

    if (!apiKey) {
      console.error(`No API key found for ${config.llm.provider}. Run 'beacon login' to set up your provider.`);
      process.exit(1);
    }

    const spinner = !isJson ? createSpinner() : null;
    const provider = createProvider(config.llm.provider, apiKey, config.llm.model);
    const results: { pkg: PackageInfo; result: AnalysisResult; score: number }[] = [];

    for (const pkg of packages) {
      spinner?.start(`Analyzing ${pkg.name}...`);
      log(`Analyzing package: ${pkg.name} (${pkg.path})`);

      const builder = new ContextBuilder(config);
      const context = await builder.build(pkg.path, verbose);
      const result = await provider.analyze(context, "analyze", config.language);

      const snapshot = buildSnapshot(context, result, getHeadCommit() ?? "unknown", getCurrentBranch());
      results.push({ pkg, result, score: snapshot.metrics.healthScore });
    }

    spinner?.succeed(`Analyzed ${results.length} packages`);

    if (isJson) {
      console.log(JSON.stringify(results.map((r) => ({
        name: r.pkg.name,
        version: r.pkg.version,
        path: r.pkg.path,
        healthScore: r.score,
        summary: r.result.summary,
        issues: r.result.recommendations.length,
      })), null, 2));
      return;
    }

    // Terminal output
    console.log(chalk.bold(`\n📦 Monorepo Analysis — ${packages.length} packages\n`));

    // Summary table
    console.log(`  ${chalk.gray("Package".padEnd(30))}${chalk.gray("Score".padStart(7))}${chalk.gray("Issues".padStart(8))}`);

    const sorted = results.sort((a, b) => a.score - b.score);
    for (const r of sorted) {
      const scoreColor = r.score >= 80 ? chalk.green : r.score >= 60 ? chalk.yellow : chalk.red;
      const issues = r.result.recommendations.length;
      console.log(
        `  ${r.pkg.name.padEnd(30)}${scoreColor(String(r.score).padStart(7))}${String(issues).padStart(8)}`
      );
    }

    const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
    const avgColor = avgScore >= 80 ? chalk.green : avgScore >= 60 ? chalk.yellow : chalk.red;
    console.log(`\n  ${chalk.bold("Average Score:")} ${avgColor(String(avgScore))}`);

    // Worst package details
    const worst = sorted[0];
    if (worst && worst.score < 80) {
      console.log(chalk.bold(`\n  ⚠ Needs attention: ${worst.pkg.name}`));
      console.log(`  ${worst.result.summary}`);
    }

    console.log("");
  } catch (error) {
    handleCliError(error, verbose);
  }
}
