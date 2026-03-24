import { simpleGit } from "simple-git";
import type { Collector, CollectorResult } from "./types.js";

export interface GitData {
  recentCommits: Array<{
    hash: string;
    message: string;
    author: string;
    date: Date;
  }>;
  activeBranches: Array<{
    name: string;
    isRemote: boolean;
    lastCommitDate: Date;
  }>;
  uncommittedChanges: string[];
  commitFrequency: { daily: number; weekly: number; monthly: number };
}

interface CommitEntry {
  hash: string;
  message: string;
  author_name: string;
  date: string;
}

interface StatusLike {
  not_added: string[];
  modified: string[];
  deleted: string[];
  created: string[];
  renamed: Array<{ from: string; to: string }>;
  conflicted: string[];
}

const EMPTY_STATUS: StatusLike = {
  not_added: [],
  modified: [],
  deleted: [],
  created: [],
  renamed: [],
  conflicted: [],
};

export class GitCollector implements Collector<GitData> {
  name = "git";

  async collect(projectPath: string): Promise<CollectorResult<GitData>> {
    const start = Date.now();
    const git = simpleGit(projectPath);

    // Collect log, branches, and status in parallel — each fallible independently
    let commits: CommitEntry[] = [];
    let branchAll: string[] = [];
    let status: StatusLike = EMPTY_STATUS;

    await Promise.all([
      git
        .log({ maxCount: 30 })
        .then((r) => {
          commits = r.all as unknown as CommitEntry[];
        })
        .catch(() => {}),

      git
        .branch(["-a", "--sort=-committerdate"])
        .then((r) => {
          branchAll = r.all;
        })
        .catch(() => {}),

      git
        .status()
        .then((r) => {
          status = {
            not_added: r.not_added,
            modified: r.modified,
            deleted: r.deleted,
            created: r.created,
            renamed: r.renamed.map((rn) => ({ from: rn.from ?? "", to: rn.to })),
            conflicted: r.conflicted,
          };
        })
        .catch(() => {}),
    ]);

    // Recent commits
    const recentCommits = commits.map((commit) => ({
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      date: new Date(commit.date),
    }));

    // Active branches
    const activeBranches = await Promise.all(
      branchAll.slice(0, 20).map(async (branchName: string) => {
        const isRemote = branchName.startsWith("remotes/");
        const cleanName = isRemote
          ? branchName.replace(/^remotes\//, "")
          : branchName;

        let lastCommitDate = new Date(0);
        try {
          const branchLog = await git.log({ maxCount: 1, from: branchName });
          if (branchLog.latest) {
            const latest = branchLog.latest as CommitEntry;
            lastCommitDate = new Date(latest.date);
          }
        } catch {
          // ignore branch log errors
        }

        return { name: cleanName, isRemote, lastCommitDate };
      })
    );

    // Uncommitted changes
    const uncommittedChanges: string[] = [
      ...status.not_added.map((f: string) => `?? ${f}`),
      ...status.modified.map((f: string) => ` M ${f}`),
      ...status.deleted.map((f: string) => ` D ${f}`),
      ...status.created.map((f: string) => `A  ${f}`),
      ...status.renamed.map((r) => `R  ${r.from} -> ${r.to}`),
      ...status.conflicted.map((f: string) => `UU ${f}`),
    ];

    // Commit frequency — get more commits if possible
    let allCommitDates: Date[] = recentCommits.map((c) => c.date);
    try {
      const allLog = await git.log({ maxCount: 1000 });
      allCommitDates = (allLog.all as unknown as CommitEntry[]).map(
        (c) => new Date(c.date)
      );
    } catch {
      // fall back to the 30 recent commits already collected
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const commitFrequency = {
      daily: allCommitDates.filter((d) => d >= oneDayAgo).length,
      weekly: allCommitDates.filter((d) => d >= oneWeekAgo).length,
      monthly: allCommitDates.filter((d) => d >= oneMonthAgo).length,
    };

    return {
      source: "git",
      data: {
        recentCommits,
        activeBranches,
        uncommittedChanges,
        commitFrequency,
      },
      metadata: {
        collectedAt: new Date(),
        duration: Date.now() - start,
      },
    };
  }
}
