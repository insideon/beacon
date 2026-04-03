import type { AnalysisResult, Recommendation, LLMProvider } from "./types.js";
import type { ProjectContext } from "../context/types.js";

/**
 * Run analysis across multiple providers and merge results.
 * Recommendations that appear in multiple models get boosted priority.
 */
export async function consensusAnalysis(
  providers: LLMProvider[],
  context: ProjectContext,
  promptType: string
): Promise<{ result: AnalysisResult; providerResults: { provider: string; result: AnalysisResult }[] }> {
  // Run all providers in parallel
  const settled = await Promise.allSettled(
    providers.map(async (p) => ({
      provider: p.name,
      result: await p.analyze(context, promptType),
    }))
  );

  const providerResults: { provider: string; result: AnalysisResult }[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") {
      providerResults.push(s.value);
    }
  }

  if (providerResults.length === 0) {
    throw new Error("All providers failed during consensus analysis");
  }

  if (providerResults.length === 1) {
    return { result: providerResults[0].result, providerResults };
  }

  // Merge recommendations
  const merged = mergeRecommendations(providerResults.map((r) => r.result));

  // Pick the best summary (longest, most detailed)
  const summary = providerResults
    .map((r) => r.result.summary)
    .sort((a, b) => b.length - a.length)[0];

  const result: AnalysisResult = {
    summary: `[Consensus from ${providerResults.length} models] ${summary}`,
    recommendations: merged,
    todaysFocus: merged
      .filter((r) => r.priority === "critical" || r.priority === "high")
      .slice(0, 5),
  };

  return { result, providerResults };
}

/**
 * Merge recommendations from multiple analyses.
 * Similar recommendations (by title similarity) are deduplicated,
 * and items found by multiple models get priority boosted.
 */
function mergeRecommendations(results: AnalysisResult[]): Recommendation[] {
  const allRecs: (Recommendation & { votes: number })[] = [];

  for (const result of results) {
    for (const rec of result.recommendations) {
      const existing = allRecs.find((r) => isSimilar(r.title, rec.title));
      if (existing) {
        existing.votes++;
        // Boost priority if multiple models agree
        existing.priority = higherPriority(existing.priority, rec.priority);
      } else {
        allRecs.push({ ...rec, votes: 1 });
      }
    }
  }

  // Sort: most votes first, then by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allRecs.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return allRecs.map(({ votes, ...rec }) => ({
    ...rec,
    reasoning: votes > 1
      ? `[Confirmed by ${votes} models] ${rec.reasoning}`
      : rec.reasoning,
  }));
}

function isSimilar(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Check if one contains the other or significant overlap
  if (na.includes(nb) || nb.includes(na)) return true;
  // Simple word overlap check
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w) && w.length > 3);
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size > 0.5;
}

function higherPriority(
  a: Recommendation["priority"],
  b: Recommendation["priority"]
): Recommendation["priority"] {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[a] <= order[b] ? a : b;
}
