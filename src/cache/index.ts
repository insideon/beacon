import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { AnalysisResult } from "../analyzer/types.js";

const DEFAULT_CACHE_DIR = ".beacon/cache";

function getCachePath(commitHash: string, promptType: string, cacheDir: string): string {
  return join(cacheDir, `${commitHash}-${promptType}.json`);
}

export async function getCache(
  commitHash: string,
  promptType: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): Promise<AnalysisResult | null> {
  try {
    const content = await readFile(
      getCachePath(commitHash, promptType, cacheDir),
      "utf-8"
    );
    return JSON.parse(content) as AnalysisResult;
  } catch {
    return null;
  }
}

export async function setCache(
  commitHash: string,
  promptType: string,
  result: AnalysisResult,
  cacheDir: string = DEFAULT_CACHE_DIR
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  const filePath = getCachePath(commitHash, promptType, cacheDir);
  await writeFile(filePath, JSON.stringify(result, null, 2), "utf-8");
}
