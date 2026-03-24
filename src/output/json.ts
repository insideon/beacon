import { AnalysisResult } from "../analyzer/types.js";
import { ProjectContext } from "../context/types.js";

export function renderJson(result: AnalysisResult, context: ProjectContext): string {
  return JSON.stringify(
    {
      project: {
        name: context.project.name,
        techStack: context.project.techStack,
      },
      analysis: result,
    },
    null,
    2
  );
}
