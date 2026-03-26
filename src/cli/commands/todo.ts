import { loadConfig, resolveApiKey } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { renderTerminal } from "../../output/terminal.js";
import { renderJson } from "../../output/json.js";
import type { AnalysisResult } from "../../analyzer/types.js";

export async function todoCommand(options: {
  json?: boolean;
  today?: boolean;
  verbose?: boolean;
}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = options.verbose ?? false;
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

    log("Collecting project data...");
    const builder = new ContextBuilder(config);
    const context = await builder.build(projectPath, verbose);

    const modelLabel = config.llm.model ?? "default";
    log(`Using provider: ${config.llm.provider} (${modelLabel})`);

    const provider = createProvider(config.llm.provider, apiKey, config.llm.model);

    log("Calling LLM API...");
    const llmStart = Date.now();
    const result = await provider.analyze(context, "todo");
    const llmElapsed = ((Date.now() - llmStart) / 1000).toFixed(1);
    log(`LLM response received (${llmElapsed}s)`);

    let filtered: AnalysisResult = result;
    if (options.today) {
      filtered = {
        ...result,
        recommendations: result.todaysFocus,
      };
    }

    if (options.json) {
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
