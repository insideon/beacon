import type { Collector } from "../collectors/types.js";
import type { ProjectContext } from "./types.js";

export class ContextBuilder {
  constructor(private readonly collectors: Collector[]) {}
  async build(_projectPath: string): Promise<ProjectContext> {
    // stub - will be implemented in Step 4
    throw new Error("Not implemented");
  }
}
