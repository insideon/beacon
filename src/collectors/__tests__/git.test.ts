import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { simpleGit } from "simple-git";
import { GitCollector } from "../git.js";

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "beacon-git-test-"));

  // Initialize a real git repo
  const git = simpleGit(tempDir);
  await git.init();
  await git.addConfig("user.email", "test@example.com");
  await git.addConfig("user.name", "Test User");

  // Create some commits
  await writeFile(join(tempDir, "README.md"), "# Test Project\n");
  await git.add(".");
  await git.commit("Initial commit");

  await writeFile(join(tempDir, "index.ts"), "export const x = 1;\n");
  await git.add(".");
  await git.commit("Add index.ts");

  await writeFile(join(tempDir, "utils.ts"), "export const y = 2;\n");
  await git.add(".");
  await git.commit("Add utils.ts");

  // Create a branch
  await git.checkoutBranch("feature/test-branch", "HEAD");
  await git.checkout("master").catch(() => git.checkout("main"));

  // Add an uncommitted file
  await writeFile(join(tempDir, "uncommitted.ts"), "// pending\n");
});

afterAll(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("GitCollector", () => {
  it("has the correct name", () => {
    const collector = new GitCollector();
    expect(collector.name).toBe("git");
  });

  it("returns a CollectorResult with correct shape", async () => {
    const collector = new GitCollector();
    const result = await collector.collect(tempDir);

    expect(result).toHaveProperty("source", "git");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("metadata");
    expect(result.metadata).toHaveProperty("collectedAt");
    expect(result.metadata).toHaveProperty("duration");
    expect(result.metadata.collectedAt).toBeInstanceOf(Date);
    expect(typeof result.metadata.duration).toBe("number");
  });

  it("collects recent commits", async () => {
    const collector = new GitCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.recentCommits.length).toBeGreaterThanOrEqual(3);

    const commit = result.data.recentCommits[0];
    expect(commit).toHaveProperty("hash");
    expect(commit).toHaveProperty("message");
    expect(commit).toHaveProperty("author");
    expect(commit).toHaveProperty("date");
    expect(commit.date).toBeInstanceOf(Date);
    expect(typeof commit.hash).toBe("string");
    expect(commit.hash.length).toBeGreaterThan(0);
  });

  it("includes the expected commit messages", async () => {
    const collector = new GitCollector();
    const result = await collector.collect(tempDir);

    const messages = result.data.recentCommits.map((c) => c.message);
    expect(messages).toContain("Add utils.ts");
    expect(messages).toContain("Add index.ts");
    expect(messages).toContain("Initial commit");
  });

  it("collects branches", async () => {
    const collector = new GitCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.activeBranches.length).toBeGreaterThanOrEqual(1);

    const branch = result.data.activeBranches[0];
    expect(branch).toHaveProperty("name");
    expect(branch).toHaveProperty("isRemote");
    expect(branch).toHaveProperty("lastCommitDate");
    expect(branch.lastCommitDate).toBeInstanceOf(Date);
    expect(typeof branch.isRemote).toBe("boolean");
  });

  it("includes feature branch", async () => {
    const collector = new GitCollector();
    const result = await collector.collect(tempDir);

    const branchNames = result.data.activeBranches.map((b) => b.name);
    const hasFeatureBranch = branchNames.some(
      (n) => n.includes("feature/test-branch") || n === "feature/test-branch"
    );
    expect(hasFeatureBranch).toBe(true);
  });

  it("detects uncommitted changes", async () => {
    const collector = new GitCollector();
    const result = await collector.collect(tempDir);

    // We added uncommitted.ts but didn't stage/commit it
    expect(result.data.uncommittedChanges.length).toBeGreaterThan(0);
    const hasUncommitted = result.data.uncommittedChanges.some((c) =>
      c.includes("uncommitted.ts")
    );
    expect(hasUncommitted).toBe(true);
  });

  it("returns commit frequency stats", async () => {
    const collector = new GitCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.commitFrequency).toHaveProperty("daily");
    expect(result.data.commitFrequency).toHaveProperty("weekly");
    expect(result.data.commitFrequency).toHaveProperty("monthly");

    // All commits were made just now, so they should all count for all periods
    expect(result.data.commitFrequency.monthly).toBeGreaterThanOrEqual(3);
    expect(result.data.commitFrequency.weekly).toBeGreaterThanOrEqual(3);
    expect(result.data.commitFrequency.daily).toBeGreaterThanOrEqual(3);
  });

  it("handles non-git directories gracefully", async () => {
    const nonGitDir = await mkdtemp(join(tmpdir(), "beacon-non-git-"));
    try {
      const collector = new GitCollector();
      // Should not throw — returns empty data
      const result = await collector.collect(nonGitDir);
      expect(result).toHaveProperty("source", "git");
      expect(Array.isArray(result.data.recentCommits)).toBe(true);
      expect(Array.isArray(result.data.activeBranches)).toBe(true);
    } finally {
      await rm(nonGitDir, { recursive: true, force: true });
    }
  });
});
