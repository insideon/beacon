import { loadConfig, resolveApiKey } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { renderTerminal } from "../../output/terminal.js";
import { renderJson } from "../../output/json.js";
import { getCache, setCache } from "../../cache/index.js";
import { execSync } from "child_process";
import ora from "ora";
import type { AnalysisResult } from "../../analyzer/types.js";

function getHeadCommit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

export async function todoCommand(options: {
  json?: boolean;
  today?: boolean;
  verbose?: boolean;
  noCache?: boolean;
}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = options.verbose ?? false;
  const useCache = !(options.noCache ?? false);
  const isJson = options.json ?? false;
  const log = (msg: string) => {
    if (verbose) console.error(`[verbose] ${msg}`);
  };

  try {
    log("Loading config from .beaconrc.json");
    const config = await loadConfig(projectPath);
    const apiKey = await resolveApiKey(config.llm.provider, config.llm.apiKey);

    if (!apiKey) {
      console.error(
        `No API key found for ${config.llm.provider}. Run 'beacon login' to set up your provider.`
      );
      process.exit(1);
    }

    const spinner = !isJson ? ora() : null;

    spinner?.start("Collecting project data...");
    log("Collecting project data...");
    const builder = new ContextBuilder(config);
    const context = await builder.build(projectPath, verbose);
    spinner?.succeed("Project data collected");

    const commitHash = getHeadCommit();

    // Check cache
    if (useCache && commitHash) {
      log(`Checking cache for commit ${commitHash.slice(0, 7)}...`);
      const cached = await getCache(commitHash, "todo");
      if (cached) {
        log("Cache hit! Skipping LLM call.");
        let filtered: AnalysisResult = cached;
        if (options.today) {
          filtered = { ...cached, recommendations: cached.todaysFocus };
        }
        if (isJson) {
          console.log(renderJson(filtered, context));
        } else {
          console.log(renderTerminal(filtered, context));
        }
        return;
      }
      log("Cache miss.");
    }

    const modelLabel = config.llm.model ?? "default";
    log(`Using provider: ${config.llm.provider} (${modelLabel})`);

    const provider = createProvider(config.llm.provider, apiKey, config.llm.model);

    spinner?.start("Analyzing with AI...");
    log("Calling LLM API...");
    const llmStart = Date.now();
    const result = await provider.analyze(context, "todo");
    const llmElapsed = ((Date.now() - llmStart) / 1000).toFixed(1);
    spinner?.succeed(`Analysis complete (${llmElapsed}s)`);
    log(`LLM response received (${llmElapsed}s)`);

    // Save to cache
    if (commitHash) {
      await setCache(commitHash, "todo", result);
      log("Result cached.");
    }

    let filtered: AnalysisResult = result;
    if (options.today) {
      filtered = { ...result, recommendations: result.todaysFocus };
    }

    if (isJson) {
      console.log(renderJson(filtered, context));
    } else {
      console.log(renderTerminal(filtered, context));
    }
  } catch (error) {
    if (error instanceof Error) {
      const msg = error.message;
      console.error(`Error: ${msg}`);
      if (/api|key|auth/i.test(msg)) {
        console.error("Hint: Run 'beacon login' to set up or refresh your API key.");
      } else if (/network|ECONNREFUSED|fetch/i.test(msg)) {
        console.error("Hint: Check your internet connection and try again.");
      } else if (/parse|JSON|schema/i.test(msg)) {
        console.error("Hint: The LLM may have returned an unexpected response. Try running again.");
      }
    }
    process.exit(1);
  }
}
