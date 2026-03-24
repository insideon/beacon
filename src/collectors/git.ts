import type { Collector, CollectorResult } from "./types.js";

export class GitCollector implements Collector {
  name = "git";

  async collect(_projectPath: string): Promise<CollectorResult> {
    return {
      source: "git",
      data: null,
      metadata: {
        collectedAt: new Date(),
        duration: 0,
      },
    };
  }
}
