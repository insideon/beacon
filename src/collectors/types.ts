export interface CollectorResult<T = unknown> {
  source: string;
  data: T;
  metadata: {
    collectedAt: Date;
    duration: number;
  };
}

export interface Collector<T = unknown> {
  name: string;
  collect(projectPath: string): Promise<CollectorResult<T>>;
}
