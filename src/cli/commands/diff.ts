import chalk from "chalk";
import { getSnapshots } from "../../history/store.js";
import type { HealthSnapshot } from "../../history/types.js";

function findSnapshotForBranch(
  snapshots: HealthSnapshot[],
  branch: string
): HealthSnapshot | null {
  // Find the most recent snapshot for this branch
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i].branch === branch) {
      return snapshots[i];
    }
  }
  return null;
}

function renderDelta(value: number, inverted = false): string {
  if (value === 0) return chalk.gray("  0");
  // For score, positive is good. For issues/todos, positive is bad.
  const isGood = inverted ? value < 0 : value > 0;
  const prefix = value > 0 ? "+" : "";
  const str = `${prefix}${value}`;
  if (isGood) return chalk.green(`▲ ${str}`);
  return chalk.red(`▼ ${str}`);
}

export async function diffCommand(options: {
  json?: boolean;
  base?: string;
}): Promise<void> {
  const base = options.base ?? "main";
  const snapshots = await getSnapshots();

  if (snapshots.length === 0) {
    console.log("No history data yet. Run 'beacon analyze' on both branches first.");
    return;
  }

  // Find current branch from the most recent snapshot
  const current = snapshots[snapshots.length - 1];
  const currentBranch = current.branch;

  const baseSnapshot = findSnapshotForBranch(snapshots, base);
  const currentSnapshot = findSnapshotForBranch(snapshots, currentBranch);

  if (!baseSnapshot) {
    console.log(`No snapshot found for branch '${base}'. Run 'beacon analyze' on that branch first.`);
    return;
  }

  if (!currentSnapshot) {
    console.log(`No snapshot found for current branch '${currentBranch}'. Run 'beacon analyze' first.`);
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({
      base: { branch: base, snapshot: baseSnapshot },
      current: { branch: currentBranch, snapshot: currentSnapshot },
      delta: {
        healthScore: currentSnapshot.metrics.healthScore - baseSnapshot.metrics.healthScore,
        todoCount: currentSnapshot.metrics.todoCount - baseSnapshot.metrics.todoCount,
        critical: currentSnapshot.metrics.recommendations.critical - baseSnapshot.metrics.recommendations.critical,
        high: currentSnapshot.metrics.recommendations.high - baseSnapshot.metrics.recommendations.high,
        outdatedDeps: currentSnapshot.metrics.outdatedDeps - baseSnapshot.metrics.outdatedDeps,
      },
    }, null, 2));
    return;
  }

  const bm = baseSnapshot.metrics;
  const cm = currentSnapshot.metrics;

  console.log(chalk.bold(`\n📊 Branch Impact — ${currentBranch} vs ${base}\n`));

  const rows = [
    {
      metric: "Health Score",
      base: bm.healthScore,
      current: cm.healthScore,
      delta: cm.healthScore - bm.healthScore,
      inverted: false,
    },
    {
      metric: "TODOs",
      base: bm.todoCount,
      current: cm.todoCount,
      delta: cm.todoCount - bm.todoCount,
      inverted: true,
    },
    {
      metric: "Critical",
      base: bm.recommendations.critical,
      current: cm.recommendations.critical,
      delta: cm.recommendations.critical - bm.recommendations.critical,
      inverted: true,
    },
    {
      metric: "High",
      base: bm.recommendations.high,
      current: cm.recommendations.high,
      delta: cm.recommendations.high - bm.recommendations.high,
      inverted: true,
    },
    {
      metric: "Outdated Deps",
      base: bm.outdatedDeps,
      current: cm.outdatedDeps,
      delta: cm.outdatedDeps - bm.outdatedDeps,
      inverted: true,
    },
  ];

  console.log(
    `  ${chalk.gray("Metric".padEnd(16))}${chalk.gray(base.padStart(8))}${chalk.gray(currentBranch.padStart(16))}    ${chalk.gray("Delta")}`
  );

  for (const row of rows) {
    console.log(
      `  ${row.metric.padEnd(16)}${String(row.base).padStart(8)}${String(row.current).padStart(16)}    ${renderDelta(row.delta, row.inverted)}`
    );
  }

  const scoreDelta = cm.healthScore - bm.healthScore;
  console.log("");
  if (scoreDelta > 0) {
    console.log(chalk.green(`  Impact: This branch improves health score by ${scoreDelta} points.`));
  } else if (scoreDelta < 0) {
    console.log(chalk.red(`  Impact: This branch decreases health score by ${Math.abs(scoreDelta)} points.`));
  } else {
    console.log(chalk.gray("  Impact: No change in health score."));
  }
  console.log("");
}
