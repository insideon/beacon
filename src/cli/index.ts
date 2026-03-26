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
  .version("0.1.0")
  .option("--verbose", "Enable verbose logging to stderr")
  .option("--no-cache", "Skip analysis cache");

// Default action (no subcommand) = analyze + todo
program
  .option("--json", "Output as JSON")
  .option("--no-color", "Disable colored output")
  .action(async (options) => {
    // Run analyze+todo as default
    const { verbose, cache } = program.opts();
    await analyzeCommand({ ...options, withTodo: true, verbose: verbose ?? false, noCache: !cache });
  });

program
  .command("analyze")
  .description("Analyze the project")
  .option("--json", "Output as JSON")
  .action((options) => {
    const { verbose, cache } = program.opts();
    return analyzeCommand({ ...options, verbose: verbose ?? false, noCache: !cache });
  });

program
  .command("todo")
  .description("Show prioritized task list")
  .option("--today", "Focus on today's tasks only")
  .option("--json", "Output as JSON")
  .action((options) => {
    const { verbose, cache } = program.opts();
    return todoCommand({ ...options, verbose: verbose ?? false, noCache: !cache });
  });

program
  .command("status")
  .description("Show project status summary")
  .option("--json", "Output as JSON")
  .action(statusCommand);

program
  .command("init")
  .description("Initialize Beacon configuration")
  .action(initCommand);

program
  .command("login")
  .description("Configure LLM provider and API key")
  .action(loginCommand);

program.parse();
