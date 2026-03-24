import type { Collector, CollectorResult } from "./types.js";

export class ConfigCollector implements Collector<null> {
  name = "config";

  async collect(_projectPath: string): Promise<CollectorResult<null>> {
    return {
      source: "config",
      data: null,
      metadata: {
        collectedAt: new Date(),
        duration: 0,
      },
    };
  }
}
