import { loadConfig } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { renderTerminal } from "../../output/terminal.js";
import { renderJson } from "../../output/json.js";
import type { AnalysisResult } from "../../analyzer/types.js";

export async function todoCommand(options: {
  json?: boolean;
  today?: boolean;
}): Promise<void> {
  const projectPath = process.cwd();

  try {
    // 1. Load config
    const config = await loadConfig(projectPath);

    // 2. Build context
    const builder = new ContextBuilder(config);
    const context = await builder.build(projectPath);

    // 3. Analyze with LLM using "todo" prompt type
    const provider = createProvider(config);
    const result = await provider.analyze(context, "todo");

    // 4. If --today, limit to todaysFocus only
    let filtered: AnalysisResult = result;
    if (options.today) {
      filtered = {
        ...result,
        recommendations: result.todaysFocus,
      };
    }

    // 5. Output
    if (options.json) {
      console.log(renderJson(filtered, context));
    } else {
      console.log(renderTerminal(filtered, context));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.message.includes("API key")) {
        console.error("\nRun 'beacon init' to configure your API key.");
      }
    }
    process.exit(1);
  }
}
