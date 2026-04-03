import chalk from "chalk";
import { existsSync, readFileSync } from "fs";
import { join, resolve, basename } from "path";
import { loadConfig, resolveApiKey } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { createSpinner } from "../spinner.js";
import { handleCliError } from "../errors.js";
import { buildSnapshot, getCurrentBranch } from "../../history/store.js";
import { execSync } from "child_process";
import type { AnalysisResult } from "../../analyzer/types.js";

interface RepoResult {
  name: string;
  path: string;
  score: number;
  issues: { critical: number; high: number; medium: number; low: number };
  summary: string;
}

function getHeadCommitAt(repoPath: string): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8", cwd: repoPath }).trim();
  } catch {
    return null;
  }
}

function getBranchAt(repoPath: string): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8", cwd: repoPath }).trim();
  } catch {
    return "unknown";
  }
}

function getRepoName(repoPath: string): string {
  const pkgPath = join(repoPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.name) return pkg.name;
    } catch {}
  }
  return basename(repoPath);
}

export async function multiRepoCommand(options: {
  repos: string[];
  json?: boolean;
  verbose?: boolean;
}): Promise<void> {
  const verbose = options.verbose ?? false;
  const isJson = options.json ?? false;
  const log = (msg: string) => {
    if (verbose) console.error(`[verbose] ${msg}`);
  };

  try {
    const repoPaths = options.repos.map((r) => resolve(r));

    // Validate paths
    for (const p of repoPaths) {
      if (!existsSync(p)) {
        console.error(`Path not found: ${p}`);
        process.exit(1);
      }
    }

    if (repoPaths.length === 0) {
      console.error("No repositories specified. Usage: beacon multi-repo <path1> <path2> ...");
      process.exit(1);
    }

    const spinner = !isJson ? createSpinner() : null;
    const results: RepoResult[] = [];

    for (const repoPath of repoPaths) {
      const name = getRepoName(repoPath);
      spinner?.start(`Analyzing ${name}...`);
      log(`Analyzing: ${repoPath}`);

      try {
        const config = await loadConfig(repoPath);
        const apiKey = await resolveApiKey(config.llm.provider, config.llm.apiKey);

        if (!apiKey) {
          log(`Skipping ${name}: no API key for ${config.llm.provider}`);
          continue;
        }

        const builder = new ContextBuilder(config);
        const context = await builder.build(repoPath, verbose);
        const provider = createProvider(config.llm.provider, apiKey, config.llm.model);
        const analysis = await provider.analyze(context, "analyze", config.language);

        const commitHash = getHeadCommitAt(repoPath) ?? "unknown";
        const branch = getBranchAt(repoPath);
        const snapshot = buildSnapshot(context, analysis, commitHash, branch);

        const recs = analysis.recommendations;
        results.push({
          name,
          path: repoPath,
          score: snapshot.metrics.healthScore,
          issues: {
            critical: recs.filter((r) => r.priority === "critical").length,
            high: recs.filter((r) => r.priority === "high").length,
            medium: recs.filter((r) => r.priority === "medium").length,
            low: recs.filter((r) => r.priority === "low").length,
          },
          summary: analysis.summary,
        });
      } catch (err) {
        log(`Failed to analyze ${name}: ${err instanceof Error ? err.message : String(err)}`);
        results.push({
          name,
          path: repoPath,
          score: -1,
          issues: { critical: 0, high: 0, medium: 0, low: 0 },
          summary: "Analysis failed",
        });
      }
    }

    spinner?.succeed(`Analyzed ${results.length} repositories`);

    if (isJson) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    // Terminal output
    console.log(chalk.bold(`\n🏢 Multi-Repo Analysis — ${results.length} repositories\n`));

    console.log(`  ${chalk.gray("Repository".padEnd(30))}${chalk.gray("Score".padStart(7))}${chalk.gray("Crit".padStart(6))}${chalk.gray("High".padStart(6))}${chalk.gray("Med".padStart(6))}${chalk.gray("Low".padStart(6))}`);

    const sorted = [...results].sort((a, b) => a.score - b.score);
    for (const r of sorted) {
      if (r.score === -1) {
        console.log(`  ${r.name.padEnd(30)}${chalk.red("FAIL".padStart(7))}${"-".padStart(6)}${"-".padStart(6)}${"-".padStart(6)}${"-".padStart(6)}`);
        continue;
      }
      const scoreColor = r.score >= 80 ? chalk.green : r.score >= 60 ? chalk.yellow : chalk.red;
      console.log(
        `  ${r.name.padEnd(30)}${scoreColor(String(r.score).padStart(7))}${String(r.issues.critical).padStart(6)}${String(r.issues.high).padStart(6)}${String(r.issues.medium).padStart(6)}${String(r.issues.low).padStart(6)}`
      );
    }

    const valid = results.filter((r) => r.score >= 0);
    if (valid.length > 0) {
      const avg = Math.round(valid.reduce((s, r) => s + r.score, 0) / valid.length);
      const avgColor = avg >= 80 ? chalk.green : avg >= 60 ? chalk.yellow : chalk.red;
      console.log(`\n  ${chalk.bold("Average Score:")} ${avgColor(String(avg))}`);

      const totalCritical = valid.reduce((s, r) => s + r.issues.critical, 0);
      if (totalCritical > 0) {
        console.log(chalk.red(`  ⚠ ${totalCritical} critical issue(s) across all repositories`));
      }
    }

    console.log("");
  } catch (error) {
    handleCliError(error, verbose);
  }
}
