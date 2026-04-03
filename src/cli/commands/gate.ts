import chalk from "chalk";
import { loadConfig, resolveApiKey } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { execSync } from "child_process";
import { createSpinner } from "../spinner.js";
import { handleCliError } from "../errors.js";
import { buildSnapshot, recordSnapshot, getCurrentBranch } from "../../history/store.js";
import type { GateConfig } from "../../config/types.js";

function getHeadCommit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

interface CheckResult {
  name: string;
  passed: boolean;
  actual: number;
  threshold: number;
  operator: "min" | "max";
}

function runChecks(
  gate: GateConfig,
  metrics: { healthScore: number; critical: number; high: number }
): CheckResult[] {
  const checks: CheckResult[] = [];

  if (gate.minScore !== undefined) {
    checks.push({
      name: "Health score",
      passed: metrics.healthScore >= gate.minScore,
      actual: metrics.healthScore,
      threshold: gate.minScore,
      operator: "min",
    });
  }

  if (gate.maxCritical !== undefined) {
    checks.push({
      name: "Critical issues",
      passed: metrics.critical <= gate.maxCritical,
      actual: metrics.critical,
      threshold: gate.maxCritical,
      operator: "max",
    });
  }

  if (gate.maxHigh !== undefined) {
    checks.push({
      name: "High issues",
      passed: metrics.high <= gate.maxHigh,
      actual: metrics.high,
      threshold: gate.maxHigh,
      operator: "max",
    });
  }

  return checks;
}

export async function gateCommand(options: {
  json?: boolean;
  verbose?: boolean;
  noCache?: boolean;
}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = options.verbose ?? false;
  const isJson = options.json ?? false;
  const log = (msg: string) => {
    if (verbose) console.error(`[verbose] ${msg}`);
  };

  try {
    const config = await loadConfig(projectPath);
    const gate = config.gate;

    if (!gate || Object.keys(gate).length === 0) {
      console.error("No gate thresholds configured. Add a 'gate' section to .beaconrc.json:");
      console.error('  { "gate": { "minScore": 70, "maxCritical": 0 } }');
      process.exit(1);
    }

    const apiKey = await resolveApiKey(config.llm.provider, config.llm.apiKey);
    if (!apiKey) {
      console.error(`No API key found for ${config.llm.provider}. Run 'beacon login' to set up your provider.`);
      process.exit(1);
    }

    const spinner = !isJson ? createSpinner() : null;

    spinner?.start("Collecting project data...");
    const builder = new ContextBuilder(config);
    const context = await builder.build(projectPath, verbose);
    spinner?.succeed("Project data collected");

    const commitHash = getHeadCommit();
    const provider = createProvider(config.llm.provider, apiKey, config.llm.model);

    spinner?.start("Running analysis for quality gate...");
    const llmStart = Date.now();
    const result = await provider.analyze(context, "analyze");
    const llmElapsed = ((Date.now() - llmStart) / 1000).toFixed(1);
    spinner?.succeed(`Analysis complete (${llmElapsed}s)`);

    // Record snapshot
    if (commitHash) {
      const snapshot = buildSnapshot(context, result, commitHash, getCurrentBranch());
      await recordSnapshot(snapshot);
    }

    const recs = result.recommendations;
    const metrics = {
      healthScore: buildSnapshot(context, result, commitHash ?? "unknown", getCurrentBranch()).metrics.healthScore,
      critical: recs.filter((r) => r.priority === "critical").length,
      high: recs.filter((r) => r.priority === "high").length,
    };

    const checks = runChecks(gate, metrics);

    if (isJson) {
      const passed = checks.every((c) => c.passed);
      console.log(JSON.stringify({ passed, checks }, null, 2));
      process.exit(passed ? 0 : 1);
    }

    // Terminal output
    for (const check of checks) {
      const icon = check.passed ? chalk.green("✔") : chalk.red("✗");
      const op = check.operator === "min" ? "min" : "max";
      console.log(`${icon} ${check.name}: ${check.actual} (${op}: ${check.threshold})`);
    }

    const failed = checks.filter((c) => !c.passed);
    if (failed.length === 0) {
      console.log(chalk.green("\nAll checks passed."));
      process.exit(0);
    } else {
      console.log(chalk.red(`\nGate failed: ${failed.length} check(s) did not pass.`));
      process.exit(1);
    }
  } catch (error) {
    handleCliError(error, verbose);
  }
}
