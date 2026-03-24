import type { Collector, CollectorResult } from "./types.js";

export class GitCollector implements Collector<null> {
  name = "git";

  async collect(_projectPath: string): Promise<CollectorResult<null>> {
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
