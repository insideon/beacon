#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
import { analyzeCommand } from "./commands/analyze.js";
import { todoCommand } from "./commands/todo.js";
import { statusCommand } from "./commands/status.js";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { trendCommand } from "./commands/trend.js";
import { gateCommand } from "./commands/gate.js";
import { diffCommand } from "./commands/diff.js";
import { scheduleCommand } from "./commands/schedule.js";
import { sprintCommand } from "./commands/sprint.js";
import { webhookCommand } from "./commands/webhook.js";
import { reportCommand } from "./commands/report.js";

const program = new Command();

program
  .name("beacon")
  .description("AI-powered CLI that analyzes your codebase and tells you what to work on next.")
  .version(pkg.version)
  .option("--json", "Output results as JSON")
  .option("--verbose", "Show detailed progress logs")
  .option("--no-cache", "Skip cache and force fresh analysis");

function globalOpts() {
  const { json, verbose, cache } = program.opts();
  return { json: json ?? false, verbose: verbose ?? false, noCache: !cache };
}

// Default action (no subcommand) = analyze
program
  .action(async () => {
    const args = program.args;
    if (args.length > 0) {
      if (args[0] === "help") {
        program.help();
        return;
      }
      console.error(`Unknown command: ${args[0]}\n`);
      program.help();
      return;
    }
    await analyzeCommand({ ...globalOpts(), withTodo: true });
  });

program
  .command("analyze")
  .description("Run full project analysis with AI recommendations")
  .action(() => {
    return analyzeCommand(globalOpts());
  });

program
  .command("todo")
  .description("Get a prioritized task list for your project")
  .option("--today", "Show only today's top tasks")
  .action((options) => {
    return todoCommand({ ...globalOpts(), today: options.today });
  });

program
  .command("status")
  .description("Quick project overview without AI (no API key needed)")
  .action(() => {
    return statusCommand(globalOpts());
  });

program
  .command("init")
  .description("Create a .beaconrc.json config file with defaults")
  .action(initCommand);

program
  .command("login")
  .description("Set up your LLM provider and API key")
  .action(loginCommand);

program
  .command("trend")
  .description("Show project health trends over time")
  .option("--limit <n>", "Number of snapshots to show", "10")
  .option("--metric <name>", "Metric to chart: score, todos, deps, issues", "score")
  .action((options) => {
    return trendCommand({
      json: program.opts().json ?? false,
      limit: parseInt(options.limit, 10),
      metric: options.metric,
    });
  });

program
  .command("gate")
  .description("Check project health against configured thresholds (for CI)")
  .action(() => {
    return gateCommand(globalOpts());
  });

program
  .command("diff [base]")
  .description("Compare current branch health against a base branch")
  .action((base) => {
    return diffCommand({ json: program.opts().json ?? false, base });
  });

program
  .command("schedule <action> [time]")
  .description("Manage daily reminders (set HH:MM | off | status)")
  .action((action, time) => {
    return scheduleCommand(action, time);
  });

program
  .command("sprint")
  .description("Generate a sprint/standup report from git activity")
  .option("--days <n>", "Number of days to include", "7")
  .action((options) => {
    return sprintCommand({
      json: program.opts().json ?? false,
      days: parseInt(options.days, 10),
    });
  });

program
  .command("webhook <url>")
  .description("Send analysis results to a Slack or Discord webhook")
  .option("--platform <name>", "Force platform: slack or discord")
  .action((url, options) => {
    return webhookCommand({ ...globalOpts(), url, platform: options.platform });
  });

program
  .command("report")
  .description("Generate a stakeholder-friendly project health report")
  .action(() => {
    return reportCommand(globalOpts());
  });

program.parse();
