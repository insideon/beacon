import type { Collector, CollectorResult } from "./types.js";

export class DocsCollector implements Collector {
  name = "docs";

  async collect(_projectPath: string): Promise<CollectorResult> {
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
