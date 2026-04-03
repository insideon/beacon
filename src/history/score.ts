import type { HealthMetrics } from "./types.js";

/**
 * Calculate a health score (0-100) from project metrics.
 * Starts at 100, deducts points for issues found.
 */
export function calculateHealthScore(
  metrics: Omit<HealthMetrics, "healthScore">
): number {
  let score = 100;

  // Recommendation deductions
  score -= metrics.recommendations.critical * 15;
  score -= metrics.recommendations.high * 8;
  score -= metrics.recommendations.medium * 3;
  score -= metrics.recommendations.low * 1;

  // TODO/FIXME deductions (max -10)
  score -= Math.min(metrics.todoCount * 0.5, 10);

  // Outdated deps deductions (max -10)
  score -= Math.min(metrics.outdatedDeps * 1, 10);

  // Vulnerability deductions (max -20)
  if (metrics.vulnerabilities !== undefined) {
    score -= Math.min(metrics.vulnerabilities * 5, 20);
  }

  // Test coverage deductions
  if (metrics.testCoverage === undefined) {
    score -= 5;
  } else if (metrics.testCoverage < 50) {
    score -= 10;
  } else if (metrics.testCoverage < 80) {
    score -= 5;
  }

  return Math.max(0, Math.round(score));
}
