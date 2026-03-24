import type { Collector, CollectorResult } from "./types.js";

export class CodeCollector implements Collector<null> {
  name = "code";

  async collect(_projectPath: string): Promise<CollectorResult<null>> {
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
