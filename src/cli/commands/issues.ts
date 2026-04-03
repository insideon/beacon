import chalk from "chalk";
import { execSync } from "child_process";
import { loadConfig, resolveApiKey } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { createSpinner } from "../spinner.js";
import { handleCliError } from "../errors.js";
import type { Recommendation } from "../../analyzer/types.js";

function getRepoUrl(): string | null {
  try {
    const url = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
    // Convert git@github.com:owner/repo.git → owner/repo
    const sshMatch = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
    if (sshMatch) return sshMatch[1];
    // HTTPS
    const httpsMatch = url.match(/github\.com\/(.+?)(?:\.git)?$/);
    if (httpsMatch) return httpsMatch[1];
    return null;
  } catch {
    return null;
  }
}

function hasGhCli(): boolean {
  try {
    execSync("gh --version", { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

function createGitHubIssue(repo: string, title: string, body: string, labels: string[]): string {
  const labelArgs = labels.map((l) => `--label "${l}"`).join(" ");
  const result = execSync(
    `gh issue create --repo "${repo}" --title "${title}" --body "${body}" ${labelArgs} 2>&1`,
    { encoding: "utf-8" }
  ).trim();
  return result;
}

const priorityLabels: Record<string, string> = {
  critical: "priority: critical",
  high: "priority: high",
  medium: "priority: medium",
  low: "priority: low",
};

const categoryLabels: Record<string, string> = {
  bug: "bug",
  feature: "enhancement",
  refactor: "refactor",
  docs: "documentation",
  ops: "ops",
  strategy: "strategy",
};

export async function issuesCommand(options: {
  json?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  minPriority?: string;
}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = options.verbose ?? false;
  const isJson = options.json ?? false;
  const dryRun = options.dryRun ?? false;
  const minPriority = options.minPriority ?? "high";
  const log = (msg: string) => {
    if (verbose) console.error(`[verbose] ${msg}`);
  };

  try {
    if (!dryRun) {
      if (!hasGhCli()) {
        console.error("GitHub CLI (gh) is required. Install it: https://cli.github.com");
        process.exit(1);
      }

      const repo = getRepoUrl();
      if (!repo) {
        console.error("Could not detect GitHub repository. Make sure 'origin' remote points to GitHub.");
        process.exit(1);
      }
      log(`Detected repo: ${repo}`);
    }

    const config = await loadConfig(projectPath);
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

    const provider = createProvider(config.llm.provider, apiKey, config.llm.model);

    spinner?.start("Analyzing...");
    const result = await provider.analyze(context, "analyze", config.language);
    spinner?.succeed("Analysis complete");

    // Filter by minimum priority
    const priorityOrder = ["critical", "high", "medium", "low"];
    const minIdx = priorityOrder.indexOf(minPriority);
    const filtered = result.recommendations.filter(
      (r) => priorityOrder.indexOf(r.priority) <= minIdx
    );

    if (filtered.length === 0) {
      console.log(`No recommendations at '${minPriority}' priority or above.`);
      return;
    }

    if (isJson) {
      console.log(JSON.stringify(filtered.map((r) => ({
        title: `[Beacon] ${r.title}`,
        body: `${r.description}\n\n**Priority:** ${r.priority}\n**Category:** ${r.category}\n**Effort:** ${r.effort}\n**Reasoning:** ${r.reasoning}\n\n---\n*Created by Beacon*`,
        labels: [priorityLabels[r.priority], categoryLabels[r.category]].filter(Boolean),
      })), null, 2));
      return;
    }

    if (dryRun) {
      console.log(chalk.bold(`\n📋 Issues to create (dry run) — ${filtered.length} items\n`));
      for (const r of filtered) {
        const emoji = r.priority === "critical" ? "🔴" : r.priority === "high" ? "🟠" : "🟡";
        console.log(`  ${emoji} [Beacon] ${r.title}`);
        console.log(chalk.gray(`     ${r.description}`));
        console.log(chalk.gray(`     Labels: ${r.priority}, ${r.category}`));
        console.log("");
      }
      console.log("Run without --dry-run to create these issues on GitHub.");
      return;
    }

    const repo = getRepoUrl()!;
    console.log(chalk.bold(`\nCreating ${filtered.length} GitHub issues...\n`));

    for (const r of filtered) {
      const title = `[Beacon] ${r.title}`;
      const body = `${r.description}\n\n**Priority:** ${r.priority}\n**Category:** ${r.category}\n**Effort:** ${r.effort}\n**Reasoning:** ${r.reasoning}\n\n---\n*Created by [Beacon](https://github.com/insideon/beacon)*`;
      const labels = [priorityLabels[r.priority], categoryLabels[r.category]].filter(Boolean);

      try {
        const url = createGitHubIssue(repo, title, body, labels);
        console.log(chalk.green(`  ✔ ${title}`));
        console.log(chalk.gray(`    ${url}`));
      } catch (err) {
        console.error(chalk.red(`  ✗ Failed: ${title}`));
        if (verbose && err instanceof Error) {
          console.error(chalk.gray(`    ${err.message}`));
        }
      }
    }

    console.log("");
  } catch (error) {
    handleCliError(error, verbose);
  }
}
