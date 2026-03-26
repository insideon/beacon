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

program.parse();
