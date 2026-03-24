import chalk from "chalk";
import { loadConfig } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import type { ProjectContext } from "../../context/types.js";

function renderStatusTerminal(context: ProjectContext): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`📡 Beacon Status — ${context.project.name}`));
  lines.push("");

  // Tech stack
  if (context.project.techStack.length > 0) {
    lines.push(
      chalk.bold("Tech Stack: ") + context.project.techStack.join(", ")
    );
  }

  // Purpose
  if (context.project.purpose) {
    lines.push(chalk.bold("Purpose:    ") + context.project.purpose);
  }

  lines.push("");

  // Recent activity
  const recentCommits = context.activity.recentCommits;
  const lastCommit = recentCommits[0];
  if (lastCommit) {
    const timeAgo = formatRelativeTime(lastCommit.date);
    lines.push(
      chalk.bold("Last Commit:   ") +
        `${lastCommit.message.slice(0, 60)} (${timeAgo})`
    );
  } else {
    lines.push(chalk.bold("Last Commit:   ") + chalk.gray("none"));
  }

  lines.push(
    chalk.bold("Active Branches: ") + context.activity.activeBranches.length
  );

  if (context.activity.uncommittedChanges.length > 0) {
    lines.push(
      chalk.bold("Uncommitted:   ") +
        chalk.yellow(`${context.activity.uncommittedChanges.length} file(s)`)
    );
  }

  lines.push("");

  // Health indicators
  lines.push(chalk.bold("Health:"));
  lines.push(
    `  TODOs/FIXMEs: ${
      context.health.todos.length > 0
        ? chalk.yellow(String(context.health.todos.length))
        : chalk.green("0")
    }`
  );
  if (context.health.testCoverage !== undefined) {
    const coverageStr = `${context.health.testCoverage}%`;
    lines.push(
      `  Test Coverage: ${
        context.health.testCoverage >= 80
          ? chalk.green(coverageStr)
          : context.health.testCoverage >= 50
          ? chalk.yellow(coverageStr)
          : chalk.red(coverageStr)
      }`
    );
  }

  lines.push("");

  // Docs
  lines.push(chalk.bold("Docs:"));
  lines.push(
    `  README:    ${context.docs.hasReadme ? chalk.green("✓") : chalk.red("✗")}`
  );
  lines.push(
    `  Changelog: ${
      context.docs.hasChangelog ? chalk.green("✓") : chalk.gray("—")
    }`
  );
  if (context.docs.lastDocUpdate) {
    lines.push(
      `  Last Updated: ${formatRelativeTime(context.docs.lastDocUpdate)}`
    );
  }

  return lines.join("\n");
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

export async function statusCommand(options: {
  json?: boolean;
}): Promise<void> {
  const projectPath = process.cwd();

  try {
    const config = await loadConfig(projectPath);
    const builder = new ContextBuilder(config);
    const context = await builder.build(projectPath);

    if (options.json) {
      console.log(JSON.stringify(context, null, 2));
    } else {
      console.log(renderStatusTerminal(context));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}
