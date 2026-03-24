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
  lines.push(chalk.bold("📊 프로젝트 상태: ") + firstSummaryLine);

  // Activity stats
  const recentCommits = context.activity.recentCommits;
  const lastCommit = recentCommits.length > 0 ? recentCommits[0] : null;
  const lastCommitStr = lastCommit
    ? formatRelativeTime(lastCommit.date)
    : "없음";

  // Count commits this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weeklyCommits = recentCommits.filter(
    (c) => c.date >= oneWeekAgo
  ).length;

  const activeBranches = context.activity.activeBranches.length;

  lines.push(
    chalk.gray(
      `   마지막 커밋: ${lastCommitStr} | 이번 주 커밋: ${weeklyCommits}건 | 활성 브랜치: ${activeBranches}개`
    )
  );
  lines.push("");
  lines.push(chalk.gray(DIVIDER));
  lines.push("");

  // Today's focus section
  lines.push(chalk.bold("📋 오늘의 할일 (우선순위순)"));
  lines.push("");

  const todaysFocus = result.todaysFocus;
  if (todaysFocus.length === 0) {
    lines.push(chalk.gray("   오늘 할일이 없습니다."));
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
    lines.push(chalk.bold("💡 전략적 제안: ") + strategyTitles);
  } else {
    lines.push(chalk.bold("💡 전략적 제안: ") + chalk.gray("없음"));
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
    return "방금 전";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  } else if (diffHours < 24) {
    return `${diffHours}시간 전`;
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}주 전`;
  } else {
    return `${diffMonths}개월 전`;
  }
}

function renderRecommendation(rec: Recommendation, index: number): string {
  const colorFn = PRIORITY_COLORS[rec.priority];
  const emoji = PRIORITY_EMOJIS[rec.priority];
  const priorityLabel = colorFn(`[${rec.priority}]`);

  const lines: string[] = [];
  lines.push(` ${index}. ${emoji} ${priorityLabel} ${chalk.bold(rec.title)}`);
  lines.push(chalk.gray(`    → ${rec.description}`));
  lines.push(chalk.gray(`    예상 작업량: ${rec.effort}`));
  lines.push("");

  return lines.join("\n");
}
