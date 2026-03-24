import { describe, it, expect } from "vitest";
import { renderJson } from "../json.js";
import { AnalysisResult, Recommendation } from "../../analyzer/types.js";
import { ProjectContext } from "../../context/types.js";

function makeContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    project: {
      name: "test-project",
      purpose: "Testing",
      techStack: ["TypeScript", "Vitest"],
    },
    activity: {
      recentCommits: [],
      activeBranches: [],
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
    title: "Some task",
    description: "Do something",
    priority: "medium",
    category: "bug",
    effort: "small",
    reasoning: "Because",
    ...overrides,
  };
}

function makeResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    summary: "Everything looks good.",
    recommendations: [],
    todaysFocus: [],
    ...overrides,
  };
}

describe("renderJson", () => {
  it("returns valid JSON", () => {
    const output = renderJson(makeResult(), makeContext());
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("includes project name", () => {
    const output = renderJson(makeResult(), makeContext());
    const parsed = JSON.parse(output);
    expect(parsed.project.name).toBe("test-project");
  });

  it("includes project techStack", () => {
    const output = renderJson(makeResult(), makeContext());
    const parsed = JSON.parse(output);
    expect(parsed.project.techStack).toEqual(["TypeScript", "Vitest"]);
  });

  it("includes analysis summary", () => {
    const output = renderJson(makeResult(), makeContext());
    const parsed = JSON.parse(output);
    expect(parsed.analysis.summary).toBe("Everything looks good.");
  });

  it("includes empty recommendations array", () => {
    const output = renderJson(makeResult(), makeContext());
    const parsed = JSON.parse(output);
    expect(parsed.analysis.recommendations).toEqual([]);
    expect(parsed.analysis.todaysFocus).toEqual([]);
  });

  it("includes recommendation data", () => {
    const rec = makeRecommendation({ title: "Fix the bug", priority: "critical" });
    const result = makeResult({ recommendations: [rec], todaysFocus: [rec] });
    const output = renderJson(result, makeContext());
    const parsed = JSON.parse(output);
    expect(parsed.analysis.recommendations).toHaveLength(1);
    expect(parsed.analysis.recommendations[0].title).toBe("Fix the bug");
    expect(parsed.analysis.recommendations[0].priority).toBe("critical");
    expect(parsed.analysis.todaysFocus).toHaveLength(1);
  });

  it("formats output with 2-space indentation", () => {
    const output = renderJson(makeResult(), makeContext());
    // Indented JSON has lines starting with spaces
    expect(output).toContain('  "project"');
    expect(output).toContain('  "analysis"');
  });

  it("does not include extraneous project fields (purpose, activity, etc.)", () => {
    const output = renderJson(makeResult(), makeContext());
    const parsed = JSON.parse(output);
    expect(parsed.project).not.toHaveProperty("purpose");
    expect(parsed).not.toHaveProperty("activity");
    expect(parsed).not.toHaveProperty("health");
  });

  it("handles multiple recommendations", () => {
    const recs: Recommendation[] = [
      makeRecommendation({ title: "Task 1", priority: "critical", category: "bug" }),
      makeRecommendation({ title: "Task 2", priority: "low", category: "docs" }),
      makeRecommendation({ title: "Task 3", priority: "medium", category: "strategy" }),
    ];
    const output = renderJson(makeResult({ recommendations: recs }), makeContext());
    const parsed = JSON.parse(output);
    expect(parsed.analysis.recommendations).toHaveLength(3);
    expect(parsed.analysis.recommendations[0].category).toBe("bug");
    expect(parsed.analysis.recommendations[1].category).toBe("docs");
    expect(parsed.analysis.recommendations[2].category).toBe("strategy");
  });

  it("reflects different project names", () => {
    const context = makeContext({ project: { name: "another-project", purpose: "Other", techStack: ["Go"] } });
    const output = renderJson(makeResult(), context);
    const parsed = JSON.parse(output);
    expect(parsed.project.name).toBe("another-project");
    expect(parsed.project.techStack).toEqual(["Go"]);
  });
});
