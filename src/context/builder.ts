import type { ProjectContext } from "./types.js";

export class ContextBuilder {
  async build(_projectPath: string): Promise<ProjectContext> {
    return {
      project: {
        name: "",
        purpose: "",
        techStack: [],
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
        hasReadme: false,
        hasChangelog: false,
      },
    };
  }
}
