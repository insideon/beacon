import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getCache, setCache } from "../index.js";
import type { AnalysisResult } from "../../analyzer/types.js";

const mockResult: AnalysisResult = {
  summary: "Test summary",
  recommendations: [
    {
      title: "Test rec",
      description: "Test desc",
      priority: "high",
      category: "bug",
      effort: "small",
      reasoning: "Test reason",
    },
  ],
  todaysFocus: [],
};

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "beacon-cache-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("cache", () => {
  it("returns null when no cache exists", async () => {
    const result = await getCache("abc123", "analyze", tempDir);
    expect(result).toBeNull();
  });

  it("stores and retrieves cached result", async () => {
    await setCache("abc123", "analyze", mockResult, tempDir);
    const result = await getCache("abc123", "analyze", tempDir);
    expect(result).toEqual(mockResult);
  });

  it("returns null for different commit hash", async () => {
    await setCache("abc123", "analyze", mockResult, tempDir);
    const result = await getCache("def456", "analyze", tempDir);
    expect(result).toBeNull();
  });

  it("returns null for different prompt type", async () => {
    await setCache("abc123", "analyze", mockResult, tempDir);
    const result = await getCache("abc123", "todo", tempDir);
    expect(result).toBeNull();
  });

  it("creates cache directory if it does not exist", async () => {
    const nested = join(tempDir, "subdir");
    await setCache("abc123", "analyze", mockResult, nested);
    const content = await readFile(
      join(nested, "abc123-analyze.json"),
      "utf-8"
    );
    expect(JSON.parse(content)).toEqual(mockResult);
  });
});
