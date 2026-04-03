import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  buildSnapshot,
  recordSnapshot,
  getSnapshots,
  getLatestSnapshot,
} from "../store.js";
import type { ProjectContext } from "../../context/types.js";
import type { AnalysisResult } from "../../analyzer/types.js";

function makeContext(overrides?: Partial<ProjectContext>): ProjectContext {
  return {
    project: { name: "test", purpose: "testing", techStack: ["TypeScript"] },
    activity: {
      recentCommits: [],
      activeBranches: [],
      uncommittedChanges: [],
    },
    health: {
      todos: [
        { file: "a.ts", line: 1, text: "TODO: fix", type: "TODO" },
        { file: "b.ts", line: 2, text: "FIXME: broken", type: "FIXME" },
      ],
      outdatedDeps: [
        { name: "foo", currentVersion: "1.0.0", latestVersion: "2.0.0", isOutdated: true },
      ],
      testCoverage: 85,
    },
    docs: { hasReadme: true, hasChangelog: false },
    ...overrides,
  };
}

function makeAnalysis(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    summary: "test",
    recommendations: [
      {
        title: "Fix bug",
        description: "desc",
        priority: "high",
        category: "bug",
        effort: "small",
        reasoning: "reason",
      },
      {
        title: "Add tests",
        description: "desc",
        priority: "medium",
        category: "refactor",
        effort: "medium",
        reasoning: "reason",
      },
    ],
    todaysFocus: [],
    ...overrides,
  };
}

describe("buildSnapshot", () => {
  it("builds a snapshot with correct metrics", () => {
    const snapshot = buildSnapshot(
      makeContext(),
      makeAnalysis(),
      "abc1234def5678",
      "main",
      "1.0.0"
    );

    expect(snapshot.commitHash).toBe("abc1234def5678");
    expect(snapshot.branch).toBe("main");
    expect(snapshot.version).toBe("1.0.0");
    expect(snapshot.metrics.todoCount).toBe(2);
    expect(snapshot.metrics.outdatedDeps).toBe(1);
    expect(snapshot.metrics.testCoverage).toBe(85);
    expect(snapshot.metrics.recommendations.high).toBe(1);
    expect(snapshot.metrics.recommendations.medium).toBe(1);
    expect(snapshot.metrics.recommendations.critical).toBe(0);
    expect(snapshot.metrics.healthScore).toBeGreaterThan(0);
    expect(snapshot.metrics.healthScore).toBeLessThanOrEqual(100);
    expect(snapshot.timestamp).toBeTruthy();
  });
});

describe("recordSnapshot / getSnapshots / getLatestSnapshot", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "beacon-history-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("records a snapshot and reads it back", async () => {
    const snapshot = buildSnapshot(
      makeContext(),
      makeAnalysis(),
      "abc1234",
      "main"
    );

    const recorded = await recordSnapshot(snapshot, tempDir);
    expect(recorded).toBe(true);

    const snapshots = await getSnapshots(tempDir);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].commitHash).toBe("abc1234");
  });

  it("skips duplicate commit hash", async () => {
    const snapshot = buildSnapshot(
      makeContext(),
      makeAnalysis(),
      "abc1234",
      "main"
    );

    await recordSnapshot(snapshot, tempDir);
    const recorded = await recordSnapshot(snapshot, tempDir);
    expect(recorded).toBe(false);

    const snapshots = await getSnapshots(tempDir);
    expect(snapshots).toHaveLength(1);
  });

  it("records different commits", async () => {
    const s1 = buildSnapshot(makeContext(), makeAnalysis(), "abc1234", "main");
    const s2 = buildSnapshot(makeContext(), makeAnalysis(), "def5678", "main");

    await recordSnapshot(s1, tempDir);
    // Small delay to ensure different timestamps in filenames
    await new Promise((r) => setTimeout(r, 10));
    await recordSnapshot(s2, tempDir);

    const snapshots = await getSnapshots(tempDir);
    expect(snapshots).toHaveLength(2);
  });

  it("returns snapshots sorted by timestamp", async () => {
    const s1 = buildSnapshot(makeContext(), makeAnalysis(), "aaa1111", "main");
    await recordSnapshot(s1, tempDir);
    await new Promise((r) => setTimeout(r, 10));

    const s2 = buildSnapshot(makeContext(), makeAnalysis(), "bbb2222", "main");
    await recordSnapshot(s2, tempDir);

    const snapshots = await getSnapshots(tempDir);
    expect(snapshots[0].commitHash).toBe("aaa1111");
    expect(snapshots[1].commitHash).toBe("bbb2222");
  });

  it("getLatestSnapshot returns the most recent", async () => {
    const s1 = buildSnapshot(makeContext(), makeAnalysis(), "aaa1111", "main");
    await recordSnapshot(s1, tempDir);
    await new Promise((r) => setTimeout(r, 10));

    const s2 = buildSnapshot(makeContext(), makeAnalysis(), "bbb2222", "main");
    await recordSnapshot(s2, tempDir);

    const latest = await getLatestSnapshot(tempDir);
    expect(latest?.commitHash).toBe("bbb2222");
  });

  it("returns empty array when no history exists", async () => {
    const snapshots = await getSnapshots(join(tempDir, "nonexistent"));
    expect(snapshots).toEqual([]);
  });

  it("getLatestSnapshot returns null when no history exists", async () => {
    const latest = await getLatestSnapshot(join(tempDir, "nonexistent"));
    expect(latest).toBeNull();
  });
});
