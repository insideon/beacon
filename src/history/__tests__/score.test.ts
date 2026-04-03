import { describe, it, expect } from "vitest";
import { calculateHealthScore } from "../score.js";

describe("calculateHealthScore", () => {
  it("returns 100 for a perfect project with test coverage", () => {
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 0,
      outdatedDeps: 0,
      testCoverage: 90,
      recommendations: { critical: 0, high: 0, medium: 0, low: 0 },
    });
    expect(score).toBe(100);
  });

  it("deducts 15 per critical recommendation", () => {
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 0,
      outdatedDeps: 0,
      testCoverage: 90,
      recommendations: { critical: 2, high: 0, medium: 0, low: 0 },
    });
    expect(score).toBe(70);
  });

  it("deducts 8 per high recommendation", () => {
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 0,
      outdatedDeps: 0,
      testCoverage: 90,
      recommendations: { critical: 0, high: 3, medium: 0, low: 0 },
    });
    expect(score).toBe(76);
  });

  it("deducts 3 per medium, 1 per low", () => {
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 0,
      outdatedDeps: 0,
      testCoverage: 90,
      recommendations: { critical: 0, high: 0, medium: 2, low: 3 },
    });
    expect(score).toBe(91);
  });

  it("caps TODO deduction at 10", () => {
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 50,
      outdatedDeps: 0,
      testCoverage: 90,
      recommendations: { critical: 0, high: 0, medium: 0, low: 0 },
    });
    expect(score).toBe(90);
  });

  it("caps outdated deps deduction at 10", () => {
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 0,
      outdatedDeps: 30,
      testCoverage: 90,
      recommendations: { critical: 0, high: 0, medium: 0, low: 0 },
    });
    expect(score).toBe(90);
  });

  it("deducts 5 when test coverage is undefined", () => {
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 0,
      outdatedDeps: 0,
      recommendations: { critical: 0, high: 0, medium: 0, low: 0 },
    });
    expect(score).toBe(95);
  });

  it("deducts 10 when test coverage is below 50%", () => {
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 0,
      outdatedDeps: 0,
      testCoverage: 30,
      recommendations: { critical: 0, high: 0, medium: 0, low: 0 },
    });
    expect(score).toBe(90);
  });

  it("deducts 5 when test coverage is 50-79%", () => {
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 0,
      outdatedDeps: 0,
      testCoverage: 65,
      recommendations: { critical: 0, high: 0, medium: 0, low: 0 },
    });
    expect(score).toBe(95);
  });

  it("floors at 0 for heavily penalized projects", () => {
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 50,
      outdatedDeps: 30,
      testCoverage: 10,
      recommendations: { critical: 5, high: 5, medium: 5, low: 5 },
    });
    expect(score).toBe(0);
  });

  it("combines all deductions correctly", () => {
    // 100 - 15 - 8 - 3 - 1 - 2.5 - 2 - 5 = 63.5 → 64
    const score = calculateHealthScore({
      totalFiles: 10,
      totalLines: 1000,
      todoCount: 5,
      outdatedDeps: 2,
      testCoverage: 60,
      recommendations: { critical: 1, high: 1, medium: 1, low: 1 },
    });
    expect(score).toBe(64);
  });
});
