export interface CollectorResult {
  source: string;
  data: unknown;
  metadata: {
    collectedAt: Date;
    duration: number;
  };
}

export interface Collector {
  name: string;
  collect(projectPath: string): Promise<CollectorResult>;
}
