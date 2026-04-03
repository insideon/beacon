import chalk from "chalk";
import { execSync } from "child_process";

interface SprintCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface SprintSummary {
  period: string;
  totalCommits: number;
  authors: { name: string; commits: number }[];
  topChanges: string[];
  filesChanged: number;
  insertions: number;
  deletions: number;
}

function getCommits(days: number): SprintCommit[] {
  try {
    const since = `${days} days ago`;
    const raw = execSync(
      `git log --since="${since}" --pretty=format:"%H|||%an|||%ai|||%s" --no-merges`,
      { encoding: "utf-8" }
    ).trim();

    if (!raw) return [];

    return raw.split("\n").map((line) => {
      const [hash, author, date, message] = line.split("|||");
      return { hash, author, date, message };
    });
  } catch {
    return [];
  }
}

function getDiffStats(days: number): { files: number; insertions: number; deletions: number } {
  try {
    const since = `${days} days ago`;
    const raw = execSync(
      `git diff --shortstat $(git log --since="${since}" --reverse --pretty=format:"%H" | head -1)^ HEAD 2>/dev/null || git diff --shortstat --cached`,
      { encoding: "utf-8" }
    ).trim();

    const filesMatch = raw.match(/(\d+) files? changed/);
    const insMatch = raw.match(/(\d+) insertions?/);
    const delMatch = raw.match(/(\d+) deletions?/);

    return {
      files: filesMatch ? parseInt(filesMatch[1]) : 0,
      insertions: insMatch ? parseInt(insMatch[1]) : 0,
      deletions: delMatch ? parseInt(delMatch[1]) : 0,
    };
  } catch {
    return { files: 0, insertions: 0, deletions: 0 };
  }
}

function buildSummary(commits: SprintCommit[], days: number): SprintSummary {
  // Count by author
  const authorMap = new Map<string, number>();
  for (const c of commits) {
    authorMap.set(c.author, (authorMap.get(c.author) ?? 0) + 1);
  }
  const authors = [...authorMap.entries()]
    .map(([name, count]) => ({ name, commits: count }))
    .sort((a, b) => b.commits - a.commits);

  // Categorize commits by conventional commit prefix
  const categories = new Map<string, number>();
  for (const c of commits) {
    const match = c.message.match(/^(\w+)[\(:]/) ;
    const type = match ? match[1] : "other";
    categories.set(type, (categories.get(type) ?? 0) + 1);
  }
  const topChanges = [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type}: ${count}`);

  const stats = getDiffStats(days);
  const now = new Date();
  const start = new Date(now.getTime() - days * 86400000);
  const period = `${formatShortDate(start)} — ${formatShortDate(now)}`;

  return {
    period,
    totalCommits: commits.length,
    authors,
    topChanges,
    filesChanged: stats.files,
    insertions: stats.insertions,
    deletions: stats.deletions,
  };
}

function formatShortDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function renderTerminal(summary: SprintSummary): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`\n📋 Sprint Report — ${summary.period}\n`));

  lines.push(chalk.bold("Activity"));
  lines.push(`  Commits:      ${chalk.cyan(String(summary.totalCommits))}`);
  lines.push(`  Files changed: ${summary.filesChanged}`);
  lines.push(`  Lines:        ${chalk.green(`+${summary.insertions}`)} / ${chalk.red(`-${summary.deletions}`)}`);
  lines.push("");

  if (summary.authors.length > 0) {
    lines.push(chalk.bold("Contributors"));
    for (const a of summary.authors) {
      const bar = "█".repeat(Math.min(Math.ceil((a.commits / summary.totalCommits) * 20), 20));
      lines.push(`  ${a.name.padEnd(20)} ${chalk.cyan(bar)} ${a.commits}`);
    }
    lines.push("");
  }

  if (summary.topChanges.length > 0) {
    lines.push(chalk.bold("Commit Types"));
    for (const change of summary.topChanges) {
      lines.push(`  ${change}`);
    }
    lines.push("");
  }

  // Recent commits (last 10)
  return lines.join("\n");
}

export async function sprintCommand(options: {
  json?: boolean;
  days?: number;
}): Promise<void> {
  const days = options.days ?? 7;
  const commits = getCommits(days);

  if (commits.length === 0) {
    console.log(`No commits found in the last ${days} days.`);
    return;
  }

  const summary = buildSummary(commits, days);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(renderTerminal(summary));
}
