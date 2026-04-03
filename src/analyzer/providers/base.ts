import { ProjectContext } from "../../context/types.js";
import { LLMProvider, AnalysisResult } from "../types.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    const preview = raw.length > 200 ? raw.slice(0, 200) + "..." : raw;
    throw new Error(
      `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}\n\nResponse preview (first 200 chars):\n${preview}`
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

/**
 * Base class for LLM providers. Handles prompt loading, rendering, and response parsing.
 * Subclasses only need to implement `callApi()` with their specific SDK.
 */
export abstract class BaseProvider implements LLMProvider {
  abstract name: string;

  protected abstract callApi(prompt: string): Promise<string>;

  async analyze(context: ProjectContext, promptType: string, language?: string): Promise<AnalysisResult> {
    const template = this.loadTemplate(promptType);
    let prompt = renderPrompt(template, context);

    if (language && language !== "en") {
      prompt += `\n\nIMPORTANT: Write ALL text content (summary, title, description, reasoning) in ${language}. Keep JSON keys, priority values, category values, and effort values in English.`;
    }

    const raw = await this.callApi(prompt);
    return parseAnalysisResult(raw);
  }

  /**
   * Load a prompt template. Resolution order:
   * 1. User-defined: .beacon/prompts/{promptType}.md (project root)
   * 2. Bundled: dist/prompts/{promptType}.md
   * 3. Source: src/analyzer/prompts/{promptType}.md
   */
  private loadTemplate(promptType: string): string {
    // 1. User-defined custom prompt
    const userPath = join(process.cwd(), ".beacon", "prompts", `${promptType}.md`);
    try {
      return readFileSync(userPath, "utf-8");
    } catch {
      // Not found — try built-in
    }

    // 2. Bundled dist path
    const bundledPath = join(__dirname, "prompts", `${promptType}.md`);
    try {
      return readFileSync(bundledPath, "utf-8");
    } catch {
      // Not found — try source path
    }

    // 3. Source path
    const sourcePath = join(__dirname, "../prompts", `${promptType}.md`);
    try {
      return readFileSync(sourcePath, "utf-8");
    } catch (err) {
      throw new Error(
        `Failed to load prompt template "${promptType}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
