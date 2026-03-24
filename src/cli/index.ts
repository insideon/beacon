#!/usr/bin/env node
import { Command } from "commander";
import { analyzeCommand } from "./commands/analyze.js";
import { todoCommand } from "./commands/todo.js";
import { statusCommand } from "./commands/status.js";
import { initCommand } from "./commands/init.js";

const program = new Command();

program
  .name("beacon")
  .description("Your codebase has a purpose. Beacon finds it.")
  .version("0.1.0");

// Default action (no subcommand) = analyze + todo
program
  .option("--json", "Output as JSON")
  .option("--no-color", "Disable colored output")
  .action(async (options) => {
    // Run analyze+todo as default
    await analyzeCommand({ ...options, withTodo: true });
  });

program
  .command("analyze")
  .description("Analyze the project")
  .option("--json", "Output as JSON")
  .action(analyzeCommand);

program
  .command("todo")
  .description("Show prioritized task list")
  .option("--today", "Focus on today's tasks only")
  .option("--json", "Output as JSON")
  .action(todoCommand);

program
  .command("status")
  .description("Show project status summary")
  .option("--json", "Output as JSON")
  .action(statusCommand);

program
  .command("init")
  .description("Initialize Beacon configuration")
  .action(initCommand);

program.parse();
