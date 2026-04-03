import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";
import type { HealthSnapshot, HealthMetrics } from "./types.js";
import type { ProjectContext } from "../context/types.js";
import type { AnalysisResult } from "../analyzer/types.js";
import { calculateHealthScore } from "./score.js";

const HISTORY_DIR = ".beacon/history";

function getHistoryDir(projectPath?: string): string {
  return projectPath ? join(projectPath, HISTORY_DIR) : HISTORY_DIR;
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "");
}

/**
 * Build a HealthSnapshot from analysis results and project context.
 */
export function buildSnapshot(
  context: ProjectContext,
  analysis: AnalysisResult,
  commitHash: string,
  branch: string,
  version?: string
): HealthSnapshot {
  const recs = analysis.recommendations;
  const partial: Omit<HealthMetrics, "healthScore"> = {
    totalFiles: 0,
    totalLines: 0,
    todoCount: context.health.todos.length,
    outdatedDeps: context.health.outdatedDeps.filter((d) => d.isOutdated).length,
    vulnerabilities: context.health.vulnerabilities?.total,
    testCoverage: context.health.testCoverage,
    recommendations: {
      critical: recs.filter((r) => r.priority === "critical").length,
      high: recs.filter((r) => r.priority === "high").length,
      medium: recs.filter((r) => r.priority === "medium").length,
      low: recs.filter((r) => r.priority === "low").length,
    },
  };

  return {
    timestamp: new Date().toISOString(),
    commitHash,
    branch,
    version,
    metrics: {
      ...partial,
      healthScore: calculateHealthScore(partial),
    },
  };
}

/**
 * Record a snapshot to the history directory.
 * Skips if the most recent snapshot has the same commit hash.
 */
export async function recordSnapshot(
  snapshot: HealthSnapshot,
  projectPath?: string
): Promise<boolean> {
  const dir = getHistoryDir(projectPath);

  // Check for duplicate
  const latest = await getLatestSnapshot(projectPath);
  if (latest && latest.commitHash === snapshot.commitHash) {
    return false;
  }

  await mkdir(dir, { recursive: true });
  const shortHash = snapshot.commitHash.slice(0, 7);
  const ts = formatTimestamp(new Date(snapshot.timestamp));
  const filename = `${ts}-${shortHash}.json`;
  await writeFile(
    join(dir, filename),
    JSON.stringify(snapshot, null, 2),
    "utf-8"
  );
  return true;
}

/**
 * Read all snapshots, sorted by timestamp (oldest first).
 */
export async function getSnapshots(
  projectPath?: string
): Promise<HealthSnapshot[]> {
  const dir = getHistoryDir(projectPath);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  const snapshots: HealthSnapshot[] = [];

  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(dir, file), "utf-8");
      snapshots.push(JSON.parse(content) as HealthSnapshot);
    } catch {
      // skip corrupted files
    }
  }

  return snapshots;
}

/**
 * Get the most recent snapshot.
 */
export async function getLatestSnapshot(
  projectPath?: string
): Promise<HealthSnapshot | null> {
  const snapshots = await getSnapshots(projectPath);
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

/**
 * Get current git branch name.
 */
export function getCurrentBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    return "unknown";
  }
}
