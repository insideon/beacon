import chalk from "chalk";
import { getSnapshots } from "../../history/store.js";
import type { HealthSnapshot } from "../../history/types.js";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, " ")}`;
}

function renderAsciiChart(snapshots: HealthSnapshot[], metric: string): string {
  const values = snapshots.map((s) => {
    switch (metric) {
      case "todos": return s.metrics.todoCount;
      case "deps": return s.metrics.outdatedDeps;
      case "issues":
        return s.metrics.recommendations.critical +
          s.metrics.recommendations.high +
          s.metrics.recommendations.medium +
          s.metrics.recommendations.low;
      default: return s.metrics.healthScore;
    }
  });

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const height = 8;
  const lines: string[] = [];

  for (let row = height; row >= 0; row--) {
    const threshold = min + ((max - min) * row) / height;
    const label = String(Math.round(threshold)).padStart(5);
    let line = `${label} `;

    for (let col = 0; col < values.length; col++) {
      const val = values[col];
      const nextVal = col < values.length - 1 ? values[col + 1] : val;
      const atOrAbove = val >= threshold;
      const nextAtOrAbove = nextVal >= threshold;

      if (atOrAbove && row === Math.round(((val - min) / (max - min)) * height)) {
        line += "●";
      } else if (atOrAbove) {
        line += "│";
      } else {
        line += " ";
      }

      // Connector to next point
      if (col < values.length - 1) {
        if (atOrAbove && nextAtOrAbove) {
          line += "──";
        } else {
          line += "  ";
        }
      }
    }
    lines.push(line);
  }

  // X-axis
  const axis = "      " + snapshots.map((s) => formatDate(s.timestamp)).join(" ");
  lines.push("      " + "───".repeat(snapshots.length));
  lines.push(axis);

  return lines.join("\n");
}

function renderTable(snapshots: HealthSnapshot[]): string {
  const header = `  ${chalk.gray("Date")}       ${chalk.gray("Commit")}   ${chalk.gray("Score")}  ${chalk.gray("TODOs")}  ${chalk.gray("Issues")}  ${chalk.gray("Deps")}`;
  const rows = snapshots.map((s) => {
    const date = formatDate(s.timestamp);
    const hash = s.commitHash.slice(0, 7);
    const score = s.metrics.healthScore;
    const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
    const issues = s.metrics.recommendations.critical +
      s.metrics.recommendations.high +
      s.metrics.recommendations.medium +
      s.metrics.recommendations.low;

    return `  ${date}     ${chalk.gray(hash)}   ${scoreColor(String(score).padStart(5))}  ${String(s.metrics.todoCount).padStart(5)}  ${String(issues).padStart(6)}  ${String(s.metrics.outdatedDeps).padStart(4)}`;
  });

  return [header, ...rows].join("\n");
}

function renderTrendSummary(snapshots: HealthSnapshot[]): string {
  if (snapshots.length < 2) return "";

  const first = snapshots[0].metrics.healthScore;
  const last = snapshots[snapshots.length - 1].metrics.healthScore;
  const delta = last - first;
  const firstDate = new Date(snapshots[0].timestamp);
  const lastDate = new Date(snapshots[snapshots.length - 1].timestamp);
  const days = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / 86400000));

  if (delta > 0) {
    return chalk.green(`  Trend: ▲ +${delta} points over ${days} day(s)`);
  } else if (delta < 0) {
    return chalk.red(`  Trend: ▼ ${delta} points over ${days} day(s)`);
  }
  return chalk.gray(`  Trend: — no change over ${days} day(s)`);
}

export async function trendCommand(options: {
  json?: boolean;
  limit?: number;
  metric?: string;
}): Promise<void> {
  const limit = options.limit ?? 10;
  const metric = options.metric ?? "score";
  const allSnapshots = await getSnapshots();

  if (allSnapshots.length === 0) {
    console.log("No history data yet. Run 'beacon analyze' to start tracking.");
    return;
  }

  const snapshots = allSnapshots.slice(-limit);

  if (options.json) {
    console.log(JSON.stringify(snapshots, null, 2));
    return;
  }

  const metricLabel = metric === "score" ? "Health Score" :
    metric === "todos" ? "TODOs" :
    metric === "deps" ? "Outdated Deps" :
    metric === "issues" ? "Issues" : "Health Score";

  console.log(chalk.bold(`\n📈 Beacon Trend — ${metricLabel} (last ${snapshots.length} snapshots)\n`));
  console.log(renderAsciiChart(snapshots, metric));
  console.log("");
  console.log(renderTable(snapshots));
  console.log("");
  console.log(renderTrendSummary(snapshots));
  console.log("");
}
