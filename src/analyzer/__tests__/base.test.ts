import { describe, it, expect } from "vitest";
import { renderPrompt, parseAnalysisResult } from "../providers/base.js";
import { ProjectContext } from "../../context/types.js";

// Helper to create a minimal ProjectContext
function makeContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    project: {
      name: "test-project",
      purpose: "A test project for unit testing",
      techStack: ["TypeScript", "Node.js"],
    },
    activity: {
      recentCommits: [
        {
          hash: "abc1234",
          message: "Initial commit",
          author: "Alice",
          date: new Date("2024-01-15T10:00:00Z"),
        },
      ],
      activeBranches: [
        {
          name: "main",
          isRemote: false,
          lastCommitDate: new Date("2024-01-15T10:00:00Z"),
        },
      ],
      uncommittedChanges: ["src/index.ts"],
    },
    health: {
      todos: [
        { file: "src/index.ts", line: 42, text: "Fix this bug", type: "TODO" },
      ],
      outdatedDeps: [
        {
          name: "lodash",
          currentVersion: "4.17.0",
          latestVersion: "4.17.21",
          isOutdated: true,
        },
      ],
      testCoverage: 75,
    },
    docs: {
      hasReadme: true,
      hasChangelog: false,
      lastDocUpdate: new Date("2024-01-10T00:00:00Z"),
    },
    ...overrides,
  };
}

// Helper to build a valid AnalysisResult JSON string
function makeValidJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    summary: "Project looks healthy with minor issues.",
    recommendations: [
      {
        title: "Fix lodash version",
        description: "Update lodash to the latest version",
        priority: "high",
        category: "ops",
        effort: "small",
        reasoning: "Outdated dependency with potential security issues",
      },
    ],
    todaysFocus: [
      {
        title: "Fix lodash version",
        description: "Update lodash to the latest version",
        priority: "high",
        category: "ops",
        effort: "small",
        reasoning: "Quick win to improve security posture",
      },
    ],
    ...overrides,
  });
}

describe("renderPrompt", () => {
  it("replaces scalar project fields", () => {
    const template = "Project: {{project.name}}\nPurpose: {{project.purpose}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toBe("Project: test-project\nPurpose: A test project for unit testing");
  });

  it("replaces techStack as comma-separated string", () => {
    const template = "Stack: {{project.techStack}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toBe("Stack: TypeScript, Node.js");
  });

  it("replaces docs boolean fields as strings", () => {
    const template = "README: {{docs.hasReadme}}\nChangelog: {{docs.hasChangelog}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toBe("README: true\nChangelog: false");
  });

  it("replaces docs.lastDocUpdate as ISO string", () => {
    const template = "Last update: {{docs.lastDocUpdate}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toContain("2024-01-10");
  });

  it("shows 'unknown' when docs.lastDocUpdate is undefined", () => {
    const template = "Last update: {{docs.lastDocUpdate}}";
    const context = makeContext({ docs: { hasReadme: true, hasChangelog: false } });
    const result = renderPrompt(template, context);
    expect(result).toBe("Last update: unknown");
  });

  it("replaces health.testCoverage with percentage", () => {
    const template = "Coverage: {{health.testCoverage}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toBe("Coverage: 75%");
  });

  it("shows 'unknown' when health.testCoverage is undefined", () => {
    const template = "Coverage: {{health.testCoverage}}";
    const context = makeContext({
      health: {
        todos: [],
        outdatedDeps: [],
        // testCoverage omitted
      },
    });
    const result = renderPrompt(template, context);
    expect(result).toBe("Coverage: unknown");
  });

  it("replaces complex objects as formatted JSON", () => {
    const template = "Commits: {{activity.recentCommits}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toContain('"hash": "abc1234"');
    expect(result).toContain('"message": "Initial commit"');
  });

  it("replaces activity.uncommittedChanges as JSON array", () => {
    const template = "Changes: {{activity.uncommittedChanges}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toContain('"src/index.ts"');
  });

  it("replaces health.todos as JSON", () => {
    const template = "TODOs: {{health.todos}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toContain('"Fix this bug"');
    expect(result).toContain('"line": 42');
  });

  it("replaces health.outdatedDeps as JSON", () => {
    const template = "Deps: {{health.outdatedDeps}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toContain('"lodash"');
    expect(result).toContain('"4.17.21"');
  });

  it("replaces all placeholders in a template with multiple occurrences", () => {
    const template = "{{project.name}} - {{project.name}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toBe("test-project - test-project");
  });

  it("leaves unrecognized placeholders intact", () => {
    const template = "Hello {{unknown.field}}";
    const context = makeContext();
    const result = renderPrompt(template, context);
    expect(result).toBe("Hello {{unknown.field}}");
  });
});

describe("parseAnalysisResult", () => {
  it("parses a valid JSON string", () => {
    const raw = makeValidJson();
    const result = parseAnalysisResult(raw);
    expect(result.summary).toBe("Project looks healthy with minor issues.");
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].title).toBe("Fix lodash version");
    expect(result.todaysFocus).toHaveLength(1);
  });

  it("extracts JSON from markdown code block (```json ... ```)", () => {
    const json = makeValidJson();
    const raw = "Here is my analysis:\n```json\n" + json + "\n```\n";
    const result = parseAnalysisResult(raw);
    expect(result.summary).toBe("Project looks healthy with minor issues.");
  });

  it("extracts JSON from plain markdown code block (``` ... ```)", () => {
    const json = makeValidJson();
    const raw = "```\n" + json + "\n```";
    const result = parseAnalysisResult(raw);
    expect(result.summary).toBe("Project looks healthy with minor issues.");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAnalysisResult("this is not json")).toThrow(
      "Failed to parse LLM response as JSON"
    );
  });

  it("throws on JSON that doesn't match schema (missing summary)", () => {
    const raw = JSON.stringify({
      recommendations: [],
      todaysFocus: [],
    });
    expect(() => parseAnalysisResult(raw)).toThrow(
      "LLM response does not match expected schema"
    );
  });

  it("throws on schema violation (invalid priority value)", () => {
    const raw = makeValidJson({
      recommendations: [
        {
          title: "Test",
          description: "Desc",
          priority: "urgent", // invalid - not in enum
          category: "bug",
          effort: "small",
          reasoning: "reason",
        },
      ],
    });
    expect(() => parseAnalysisResult(raw)).toThrow(
      "LLM response does not match expected schema"
    );
  });

  it("throws on schema violation (invalid category value)", () => {
    const raw = makeValidJson({
      recommendations: [
        {
          title: "Test",
          description: "Desc",
          priority: "high",
          category: "invalid-category", // invalid
          effort: "small",
          reasoning: "reason",
        },
      ],
    });
    expect(() => parseAnalysisResult(raw)).toThrow(
      "LLM response does not match expected schema"
    );
  });

  it("throws on schema violation (invalid effort value)", () => {
    const raw = makeValidJson({
      recommendations: [
        {
          title: "Test",
          description: "Desc",
          priority: "high",
          category: "bug",
          effort: "huge", // invalid
          reasoning: "reason",
        },
      ],
    });
    expect(() => parseAnalysisResult(raw)).toThrow(
      "LLM response does not match expected schema"
    );
  });

  it("parses an empty recommendations and todaysFocus array", () => {
    const raw = JSON.stringify({
      summary: "All good.",
      recommendations: [],
      todaysFocus: [],
    });
    const result = parseAnalysisResult(raw);
    expect(result.recommendations).toHaveLength(0);
    expect(result.todaysFocus).toHaveLength(0);
  });

  it("parses multiple recommendations", () => {
    const raw = JSON.stringify({
      summary: "Several issues found.",
      recommendations: [
        {
          title: "Fix bug A",
          description: "desc",
          priority: "critical",
          category: "bug",
          effort: "small",
          reasoning: "reason",
        },
        {
          title: "Refactor module B",
          description: "desc",
          priority: "medium",
          category: "refactor",
          effort: "large",
          reasoning: "reason",
        },
      ],
      todaysFocus: [
        {
          title: "Fix bug A",
          description: "desc",
          priority: "critical",
          category: "bug",
          effort: "small",
          reasoning: "reason",
        },
      ],
    });
    const result = parseAnalysisResult(raw);
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].priority).toBe("critical");
    expect(result.recommendations[1].category).toBe("refactor");
  });
});
