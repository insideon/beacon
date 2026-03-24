import { describe, it, expect } from "vitest";
import { renderTerminal } from "../terminal.js";
import { AnalysisResult, Recommendation } from "../../analyzer/types.js";
import { ProjectContext } from "../../context/types.js";

// Strip ANSI color codes for easier assertion
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, "");
}

function makeContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    project: {
      name: "my-project",
      purpose: "A demo project",
      techStack: ["TypeScript", "Node.js"],
    },
    activity: {
      recentCommits: [
        {
          hash: "abc1234",
          message: "feat: add new feature",
          author: "Alice",
          date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
      ],
      activeBranches: [
        { name: "main", isRemote: false, lastCommitDate: new Date() },
        { name: "feature/x", isRemote: false, lastCommitDate: new Date() },
      ],
      uncommittedChanges: [],
    },
    health: {
      todos: [],
      outdatedDeps: [],
    },
    docs: {
      hasReadme: true,
      hasChangelog: false,
    },
    ...overrides,
  };
}

function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    title: "Default title",
    description: "Default description",
    priority: "medium",
    category: "bug",
    effort: "small",
    reasoning: "Some reasoning",
    ...overrides,
  };
}

function makeResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    summary: "Project looks healthy.\nSecond line of summary.",
    recommendations: [],
    todaysFocus: [],
    ...overrides,
  };
}

describe("renderTerminal", () => {
  it("contains project name in header", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("Beacon - my-project");
  });

  it("contains first line of summary only", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("Project looks healthy.");
    expect(output).not.toContain("Second line of summary.");
  });

  it("contains section dividers", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("━━━━━━━━━━━━");
  });

  it("contains today's focus header", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("오늘의 할일");
  });

  it("shows empty message when no todaysFocus", () => {
    const output = stripAnsi(renderTerminal(makeResult({ todaysFocus: [] }), makeContext()));
    expect(output).toContain("오늘 할일이 없습니다.");
  });

  it("shows strategy section with no recommendations", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("전략적 제안:");
    expect(output).toContain("없음");
  });

  it("renders all priority levels with correct emojis", () => {
    const todaysFocus: Recommendation[] = [
      makeRecommendation({ priority: "critical", title: "Critical task" }),
      makeRecommendation({ priority: "high", title: "High task" }),
      makeRecommendation({ priority: "medium", title: "Medium task" }),
      makeRecommendation({ priority: "low", title: "Low task" }),
    ];
    const output = renderTerminal(makeResult({ todaysFocus }), makeContext());
    // Check emojis are present in raw output (no stripping needed)
    expect(output).toContain("🔴");
    expect(output).toContain("🟡");
    expect(output).toContain("🔵");
    expect(output).toContain("⚪");
  });

  it("renders recommendation titles, descriptions, and effort", () => {
    const todaysFocus: Recommendation[] = [
      makeRecommendation({
        title: "Fix the bug",
        description: "A detailed description",
        priority: "high",
        effort: "large",
      }),
    ];
    const output = stripAnsi(renderTerminal(makeResult({ todaysFocus }), makeContext()));
    expect(output).toContain("Fix the bug");
    expect(output).toContain("A detailed description");
    expect(output).toContain("large");
  });

  it("numbers recommendations starting at 1", () => {
    const todaysFocus: Recommendation[] = [
      makeRecommendation({ title: "First" }),
      makeRecommendation({ title: "Second" }),
    ];
    const output = stripAnsi(renderTerminal(makeResult({ todaysFocus }), makeContext()));
    expect(output).toContain(" 1.");
    expect(output).toContain(" 2.");
  });

  it("renders strategy recommendations in strategy section", () => {
    const recommendations: Recommendation[] = [
      makeRecommendation({ category: "strategy", title: "Long-term plan" }),
    ];
    const output = stripAnsi(renderTerminal(makeResult({ recommendations }), makeContext()));
    expect(output).toContain("Long-term plan");
    expect(output).not.toContain("없음");
  });

  it("shows last commit relative time", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("마지막 커밋:");
    // 2 hours ago commit
    expect(output).toContain("2시간 전");
  });

  it("shows weekly commit count", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("이번 주 커밋: 1건");
  });

  it("shows active branch count", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("활성 브랜치: 2개");
  });

  it("shows 없음 for last commit when no recent commits", () => {
    const context = makeContext({
      activity: {
        recentCommits: [],
        activeBranches: [],
        uncommittedChanges: [],
      },
    });
    const output = stripAnsi(renderTerminal(makeResult(), context));
    expect(output).toContain("마지막 커밋: 없음");
    expect(output).toContain("이번 주 커밋: 0건");
    expect(output).toContain("활성 브랜치: 0개");
  });

  it("does not count old commits in weekly count", () => {
    const context = makeContext({
      activity: {
        recentCommits: [
          {
            hash: "old",
            message: "old commit",
            author: "Bob",
            date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
          },
        ],
        activeBranches: [],
        uncommittedChanges: [],
      },
    });
    const output = stripAnsi(renderTerminal(makeResult(), context));
    expect(output).toContain("이번 주 커밋: 0건");
  });
});

describe("relative time formatting (via renderTerminal)", () => {
  it("shows 방금 전 for very recent commits (< 1 min)", () => {
    const context = makeContext({
      activity: {
        recentCommits: [
          {
            hash: "a",
            message: "now",
            author: "Alice",
            date: new Date(Date.now() - 30 * 1000), // 30 seconds ago
          },
        ],
        activeBranches: [],
        uncommittedChanges: [],
      },
    });
    const output = stripAnsi(renderTerminal(makeResult(), context));
    expect(output).toContain("방금 전");
  });

  it("shows N분 전 for commits within the last hour", () => {
    const context = makeContext({
      activity: {
        recentCommits: [
          {
            hash: "b",
            message: "recent",
            author: "Alice",
            date: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
          },
        ],
        activeBranches: [],
        uncommittedChanges: [],
      },
    });
    const output = stripAnsi(renderTerminal(makeResult(), context));
    expect(output).toContain("45분 전");
  });

  it("shows N일 전 for commits within the last week", () => {
    const context = makeContext({
      activity: {
        recentCommits: [
          {
            hash: "c",
            message: "days ago",
            author: "Alice",
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          },
        ],
        activeBranches: [],
        uncommittedChanges: [],
      },
    });
    const output = stripAnsi(renderTerminal(makeResult(), context));
    expect(output).toContain("3일 전");
  });

  it("shows N주 전 for commits within last month", () => {
    const context = makeContext({
      activity: {
        recentCommits: [
          {
            hash: "d",
            message: "weeks ago",
            author: "Alice",
            date: new Date(Date.now() - 2 * 7 * 24 * 60 * 60 * 1000), // 2 weeks ago
          },
        ],
        activeBranches: [],
        uncommittedChanges: [],
      },
    });
    const output = stripAnsi(renderTerminal(makeResult(), context));
    expect(output).toContain("2주 전");
  });

  it("shows N개월 전 for old commits", () => {
    const context = makeContext({
      activity: {
        recentCommits: [
          {
            hash: "e",
            message: "old",
            author: "Alice",
            date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // ~2 months ago
          },
        ],
        activeBranches: [],
        uncommittedChanges: [],
      },
    });
    const output = stripAnsi(renderTerminal(makeResult(), context));
    expect(output).toContain("개월 전");
  });
});
