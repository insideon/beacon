#!/usr/bin/env node
import { Command } from "commander";
import { analyzeCommand } from "./commands/analyze.js";
import { todoCommand } from "./commands/todo.js";
import { statusCommand } from "./commands/status.js";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";

const program = new Command();

program
  .name("beacon")
  .description("AI-powered CLI that analyzes your codebase and tells you what to work on next.")
  .version("1.0.1")
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
  .command("help")
  .description("Show help information")
  .action(() => {
    program.help();
  });

program.on("command:*", () => {
  console.error(`Unknown command: ${program.args.join(" ")}\n`);
  program.help();
});

program.parse();
