import type { ProjectContext } from "../context/types.js";

export interface Recommendation {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "bug" | "feature" | "refactor" | "docs" | "ops" | "strategy";
  effort: "small" | "medium" | "large";
  reasoning: string;
}

export interface AnalysisResult {
  summary: string;
  recommendations: Recommendation[];
  /** Top 3-5 highest-priority items from recommendations for immediate action today */
  todaysFocus: Recommendation[];
}

export interface LLMProvider {
  name: string;
  analyze(context: ProjectContext, prompt: string): Promise<AnalysisResult>;
}
