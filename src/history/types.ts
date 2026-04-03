export interface HealthMetrics {
  totalFiles: number;
  totalLines: number;
  todoCount: number;
  outdatedDeps: number;
  vulnerabilities?: number;
  testCoverage?: number;
  recommendations: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  healthScore: number;
}

export interface HealthSnapshot {
  timestamp: string;
  commitHash: string;
  branch: string;
  version?: string;
  metrics: HealthMetrics;
}
