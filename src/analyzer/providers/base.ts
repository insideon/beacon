import { ProjectContext } from "../../context/types.js";
import { AnalysisResult } from "../types.js";
import { z } from "zod";

// Zod schema for validating LLM JSON responses
export const RecommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  category: z.enum(["bug", "feature", "refactor", "docs", "ops", "strategy"]),
  effort: z.enum(["small", "medium", "large"]),
  reasoning: z.string(),
});

export const AnalysisResultSchema = z.object({
  summary: z.string(),
  recommendations: z.array(RecommendationSchema),
  todaysFocus: z.array(RecommendationSchema),
});

/**
 * Render a prompt template with ProjectContext data.
 * Replaces {{project.name}}, {{activity.recentCommits}}, etc.
 * Complex objects are serialized as formatted JSON.
 */
export function renderPrompt(template: string, context: ProjectContext): string {
  // Scalar replacements
  let result = template
    .replace(/\{\{project\.name\}\}/g, context.project.name)
    .replace(/\{\{project\.purpose\}\}/g, context.project.purpose)
    .replace(
      /\{\{project\.techStack\}\}/g,
      context.project.techStack.join(", ")
    )
    .replace(/\{\{docs\.hasReadme\}\}/g, String(context.docs.hasReadme))
    .replace(/\{\{docs\.hasChangelog\}\}/g, String(context.docs.hasChangelog))
    .replace(
      /\{\{docs\.lastDocUpdate\}\}/g,
      context.docs.lastDocUpdate
        ? context.docs.lastDocUpdate.toISOString()
        : "unknown"
    )
    .replace(
      /\{\{health\.testCoverage\}\}/g,
      context.health.testCoverage !== undefined
        ? `${context.health.testCoverage}%`
        : "unknown"
    );

  // Complex object replacements (serialized as formatted JSON)
  result = result
    .replace(
      /\{\{activity\.recentCommits\}\}/g,
      JSON.stringify(context.activity.recentCommits, null, 2)
    )
    .replace(
      /\{\{activity\.activeBranches\}\}/g,
      JSON.stringify(context.activity.activeBranches, null, 2)
    )
    .replace(
      /\{\{activity\.uncommittedChanges\}\}/g,
      JSON.stringify(context.activity.uncommittedChanges, null, 2)
    )
    .replace(
      /\{\{health\.todos\}\}/g,
      JSON.stringify(context.health.todos, null, 2)
    )
    .replace(
      /\{\{health\.outdatedDeps\}\}/g,
      JSON.stringify(context.health.outdatedDeps, null, 2)
    );

  return result;
}

/**
 * Parse and validate LLM response JSON.
 * Extracts JSON from LLM response (may be wrapped in markdown code blocks),
 * validates with Zod schema, and returns a validated AnalysisResult.
 */
export function parseAnalysisResult(raw: string): AnalysisResult {
  // Extract JSON from potential markdown code block wrappers
  let jsonString = raw.trim();

  // Handle ```json ... ``` or ``` ... ``` blocks
  const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}\n\nRaw response:\n${raw}`
    );
  }

  // Validate with Zod schema
  const result = AnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `LLM response does not match expected schema: ${result.error.message}`
    );
  }

  return result.data;
}
