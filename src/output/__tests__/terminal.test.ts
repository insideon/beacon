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

  it("contains today's tasks header", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("Today's Tasks");
  });

  it("shows empty message when no todaysFocus", () => {
    const output = stripAnsi(renderTerminal(makeResult({ todaysFocus: [] }), makeContext()));
    expect(output).toContain("No tasks for today.");
  });

  it("shows strategy section with no recommendations", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("Strategic Suggestions:");
    expect(output).toContain("None");
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
    expect(output).not.toContain(": None");
  });

  it("shows last commit relative time", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("Last commit:");
    // 2 hours ago commit
    expect(output).toContain("2h ago");
  });

  it("shows weekly commit count", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("This week: 1 commits");
  });

  it("shows active branch count", () => {
    const output = stripAnsi(renderTerminal(makeResult(), makeContext()));
    expect(output).toContain("Active branches: 2");
  });

  it("shows N/A for last commit when no recent commits", () => {
    const context = makeContext({
      activity: {
        recentCommits: [],
        activeBranches: [],
        uncommittedChanges: [],
      },
    });
    const output = stripAnsi(renderTerminal(makeResult(), context));
    expect(output).toContain("Last commit: N/A");
    expect(output).toContain("This week: 0 commits");
    expect(output).toContain("Active branches: 0");
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
    expect(output).toContain("This week: 0 commits");
  });
});

describe("relative time formatting (via renderTerminal)", () => {
  it("shows 'just now' for very recent commits (< 1 min)", () => {
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
    expect(output).toContain("just now");
  });

  it("shows Nm ago for commits within the last hour", () => {
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
    expect(output).toContain("45m ago");
  });

  it("shows Nd ago for commits within the last week", () => {
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
    expect(output).toContain("3d ago");
  });

  it("shows Nw ago for commits within last month", () => {
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
    expect(output).toContain("2w ago");
  });

  it("shows Nmo ago for old commits", () => {
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
    expect(output).toContain("mo ago");
  });
});
