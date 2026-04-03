import chalk from "chalk";
import { loadConfig, resolveApiKey } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { createSpinner } from "../spinner.js";
import { handleCliError } from "../errors.js";
import type { AnalysisResult, Recommendation } from "../../analyzer/types.js";
import type { ProjectContext } from "../../context/types.js";

function renderOnboarding(result: AnalysisResult, context: ProjectContext): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`\n🚀 Onboarding Guide — ${context.project.name}\n`));

  // Overview
  lines.push(chalk.bold("📖 Overview"));
  lines.push(`${result.summary}\n`);

  // Tech stack
  if (context.project.techStack.length > 0) {
    lines.push(chalk.bold("🛠  Tech Stack"));
    lines.push(`  ${context.project.techStack.join(", ")}\n`);
  }

  // Getting started steps
  const steps = result.recommendations;
  if (steps.length > 0) {
    lines.push(chalk.bold("📋 Getting Started"));
    lines.push("");

    const priorityLabel: Record<string, string> = {
      critical: chalk.red("must know"),
      high: chalk.yellow("should know"),
      medium: chalk.cyan("good to know"),
      low: chalk.gray("nice to know"),
    };

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const label = priorityLabel[s.priority] ?? s.priority;
      lines.push(`  ${i + 1}. ${chalk.bold(s.title)} ${chalk.gray(`[${label}]`)}`);
      lines.push(`     ${s.description}`);
      lines.push(`     ${chalk.gray(`Effort: ${s.effort}`)}`);
      lines.push("");
    }
  }

  // First day tasks
  const firstDay = result.todaysFocus;
  if (firstDay.length > 0) {
    lines.push(chalk.bold("✅ First Day Tasks"));
    lines.push("");
    for (let i = 0; i < firstDay.length; i++) {
      const t = firstDay[i];
      lines.push(`  ${i + 1}. ${chalk.bold(t.title)}`);
      lines.push(`     ${t.description}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function renderJson(result: AnalysisResult, context: ProjectContext): string {
  return JSON.stringify({
    project: context.project.name,
    techStack: context.project.techStack,
    overview: result.summary,
    gettingStarted: result.recommendations.map((r: Recommendation) => ({
      title: r.title,
      description: r.description,
      priority: r.priority,
      category: r.category,
      effort: r.effort,
    })),
    firstDayTasks: result.todaysFocus.map((r: Recommendation) => ({
      title: r.title,
      description: r.description,
    })),
  }, null, 2);
}

export async function onboardCommand(options: {
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

    spinner?.start("Generating onboarding guide...");
    const result = await provider.analyze(context, "onboard", config.language);
    spinner?.succeed("Onboarding guide ready");

    if (isJson) {
      console.log(renderJson(result, context));
    } else {
      console.log(renderOnboarding(result, context));
    }
  } catch (error) {
    handleCliError(error, verbose);
  }
}
