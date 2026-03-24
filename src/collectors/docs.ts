import type { Collector, CollectorResult } from "./types.js";

export class DocsCollector implements Collector<null> {
  name = "docs";

  async collect(_projectPath: string): Promise<CollectorResult<null>> {
    return {
      source: "docs",
      data: null,
      metadata: {
        collectedAt: new Date(),
        duration: 0,
      },
    };
  }
}
