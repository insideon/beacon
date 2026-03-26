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
  .description("Your codebase has a purpose. Beacon finds it.")
  .version("1.0.0")
  .option("--json", "Output as JSON")
  .option("--verbose", "Enable verbose logging to stderr")
  .option("--no-cache", "Skip analysis cache");

function globalOpts() {
  const { json, verbose, cache } = program.opts();
  return { json: json ?? false, verbose: verbose ?? false, noCache: !cache };
}

// Default action (no subcommand) = analyze + todo
program
  .action(async () => {
    await analyzeCommand({ ...globalOpts(), withTodo: true });
  });

program
  .command("analyze")
  .description("Analyze the project")
  .action(() => {
    return analyzeCommand(globalOpts());
  });

program
  .command("todo")
  .description("Show prioritized task list")
  .option("--today", "Focus on today's tasks only")
  .action((options) => {
    return todoCommand({ ...globalOpts(), today: options.today });
  });

program
  .command("status")
  .description("Show project status summary")
  .action(() => {
    return statusCommand(globalOpts());
  });

program
  .command("init")
  .description("Initialize Beacon configuration")
  .action(initCommand);

program
  .command("login")
  .description("Configure LLM provider and API key")
  .action(loginCommand);

program.parse();
