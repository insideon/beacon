import chalk from "chalk";
import { execSync, spawn } from "child_process";
import { loadConfig, resolveApiKey } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { createSpinner } from "../spinner.js";
import { handleCliError } from "../errors.js";
import type { Recommendation } from "../../analyzer/types.js";

function hasClaudeCode(): boolean {
  try {
    execSync("claude --version 2>/dev/null", { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

function buildPrompt(rec: Recommendation): string {
  return `Fix the following issue in this codebase:

Title: ${rec.title}
Description: ${rec.description}
Priority: ${rec.priority}
Category: ${rec.category}
Effort: ${rec.effort}
Reasoning: ${rec.reasoning}

Please implement the fix, run tests to verify, and commit the changes.`;
}

export async function autopilotCommand(options: {
  json?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  maxTasks?: number;
  minPriority?: string;
}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = options.verbose ?? false;
  const isJson = options.json ?? false;
  const dryRun = options.dryRun ?? false;
  const maxTasks = options.maxTasks ?? 3;
  const minPriority = options.minPriority ?? "high";
  const log = (msg: string) => {
    if (verbose) console.error(`[verbose] ${msg}`);
  };

  try {
    if (!dryRun && !hasClaudeCode()) {
      console.error("Claude Code CLI is required for auto-pilot mode.");
      console.error("Install it: https://docs.anthropic.com/en/docs/claude-code");
      process.exit(1);
    }

    const config = await loadConfig(projectPath);
    const apiKey = await resolveApiKey(config.llm.provider, config.llm.apiKey);

    if (!apiKey) {
      console.error(`No API key found for ${config.llm.provider}. Run 'beacon login' to set up your provider.`);
      process.exit(1);
    }

    const spinner = !isJson ? createSpinner() : null;

    spinner?.start("Analyzing project for auto-pilot tasks...");
    const builder = new ContextBuilder(config);
    const context = await builder.build(projectPath, verbose);
    const provider = createProvider(config.llm.provider, apiKey, config.llm.model);
    const result = await provider.analyze(context, "analyze");
    spinner?.succeed("Analysis complete");

    // Filter by priority
    const priorityOrder = ["critical", "high", "medium", "low"];
    const minIdx = priorityOrder.indexOf(minPriority);
    const tasks = result.recommendations
      .filter((r) => priorityOrder.indexOf(r.priority) <= minIdx)
      .filter((r) => r.effort === "small" || r.effort === "medium")
      .slice(0, maxTasks);

    if (tasks.length === 0) {
      console.log("No tasks found matching criteria for auto-pilot.");
      return;
    }

    if (isJson) {
      console.log(JSON.stringify(tasks.map((t) => ({
        title: t.title,
        priority: t.priority,
        effort: t.effort,
        prompt: buildPrompt(t),
      })), null, 2));
      return;
    }

    if (dryRun) {
      console.log(chalk.bold(`\n🤖 Auto-pilot tasks (dry run) — ${tasks.length} tasks\n`));
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const emoji = t.priority === "critical" ? "🔴" : t.priority === "high" ? "🟠" : "🟡";
        console.log(`  ${i + 1}. ${emoji} ${t.title} ${chalk.gray(`[${t.effort}]`)}`);
        console.log(chalk.gray(`     ${t.description}`));
        console.log("");
      }
      console.log("Run without --dry-run to dispatch these to Claude Code.");
      return;
    }

    // Execute tasks with Claude Code
    console.log(chalk.bold(`\n🤖 Auto-pilot — dispatching ${tasks.length} tasks to Claude Code\n`));

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const emoji = t.priority === "critical" ? "🔴" : t.priority === "high" ? "🟠" : "🟡";
      console.log(`${emoji} Task ${i + 1}/${tasks.length}: ${t.title}`);

      const prompt = buildPrompt(t);
      log(`Prompt: ${prompt.slice(0, 100)}...`);

      try {
        const output = execSync(
          `claude --print "${prompt.replace(/"/g, '\\"')}"`,
          {
            encoding: "utf-8",
            cwd: projectPath,
            timeout: 300000, // 5 minute timeout per task
            maxBuffer: 10 * 1024 * 1024,
          }
        );
        console.log(chalk.green(`  ✔ Completed`));
        if (verbose) {
          console.log(chalk.gray(output.slice(0, 500)));
        }
      } catch (err) {
        console.log(chalk.red(`  ✗ Failed`));
        if (verbose && err instanceof Error) {
          console.log(chalk.gray(`  ${err.message.slice(0, 200)}`));
        }
      }

      console.log("");
    }

    console.log(chalk.bold("Auto-pilot complete. Review changes with 'git diff'.\n"));
  } catch (error) {
    handleCliError(error, verbose);
  }
}
