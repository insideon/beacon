import chalk from "chalk";
import { AnalysisResult, Recommendation } from "../analyzer/types.js";
import { ProjectContext } from "../context/types.js";

const PRIORITY_COLORS = {
  critical: chalk.red,
  high: chalk.yellow,
  medium: chalk.blue,
  low: chalk.gray,
};

const PRIORITY_EMOJIS = {
  critical: "🔴",
  high: "🟡",
  medium: "🔵",
  low: "⚪",
};

const DIVIDER = "━".repeat(40);

export function renderTerminal(result: AnalysisResult, context: ProjectContext): string {
  const lines: string[] = [];

  // Header
  lines.push(chalk.bold(`🔍 Beacon - ${context.project.name}`));
  lines.push("");

  // Project status section
  const summaryLines = result.summary.split("\n");
  const firstSummaryLine = summaryLines[0] ?? result.summary;
  lines.push(chalk.bold("📊 Project Status: ") + firstSummaryLine);

  // Activity stats
  const recentCommits = context.activity.recentCommits;
  const lastCommit = recentCommits.length > 0 ? recentCommits[0] : null;
  const lastCommitStr = lastCommit
    ? formatRelativeTime(lastCommit.date)
    : "N/A";

  // Count commits this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weeklyCommits = recentCommits.filter(
    (c) => c.date >= oneWeekAgo
  ).length;

  const activeBranches = context.activity.activeBranches.length;

  lines.push(
    chalk.gray(
      `   Last commit: ${lastCommitStr} | This week: ${weeklyCommits} commits | Active branches: ${activeBranches}`
    )
  );
  lines.push("");
  lines.push(chalk.gray(DIVIDER));
  lines.push("");

  // Today's focus section
  lines.push(chalk.bold("📋 Today's Tasks (by priority)"));
  lines.push("");

  const todaysFocus = result.todaysFocus;
  if (todaysFocus.length === 0) {
    lines.push(chalk.gray("   No tasks for today."));
  } else {
    todaysFocus.forEach((rec, i) => {
      lines.push(renderRecommendation(rec, i + 1));
    });
  }

  lines.push("");
  lines.push(chalk.gray(DIVIDER));
  lines.push("");

  // Strategy section
  const strategyRecs = result.recommendations.filter(
    (r) => r.category === "strategy"
  );

  if (strategyRecs.length > 0) {
    const strategyTitles = strategyRecs.map((r) => r.title).join(", ");
    lines.push(chalk.bold("💡 Strategic Suggestions: ") + strategyTitles);
  } else {
    lines.push(chalk.bold("💡 Strategic Suggestions: ") + chalk.gray("None"));
  }

  return lines.join("\n");
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  } else {
    return `${diffMonths}mo ago`;
  }
}

function renderRecommendation(rec: Recommendation, index: number): string {
  const colorFn = PRIORITY_COLORS[rec.priority];
  const emoji = PRIORITY_EMOJIS[rec.priority];
  const priorityLabel = colorFn(`[${rec.priority}]`);

  const lines: string[] = [];
  lines.push(` ${index}. ${emoji} ${priorityLabel} ${chalk.bold(rec.title)}`);
  lines.push(chalk.gray(`    → ${rec.description}`));
  lines.push(chalk.gray(`    Effort: ${rec.effort}`));
  lines.push("");

  return lines.join("\n");
}
