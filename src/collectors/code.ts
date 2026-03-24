import type { Collector, CollectorResult } from "./types.js";

export class CodeCollector implements Collector {
  name = "code";

  async collect(_projectPath: string): Promise<CollectorResult> {
    return {
      source: "code",
      data: null,
      metadata: {
        collectedAt: new Date(),
        duration: 0,
      },
    };
  }
}
