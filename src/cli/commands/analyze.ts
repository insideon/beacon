import { loadConfig } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { renderTerminal } from "../../output/terminal.js";
import { renderJson } from "../../output/json.js";

export async function analyzeCommand(options: {
  json?: boolean;
  withTodo?: boolean;
}): Promise<void> {
  const projectPath = process.cwd();

  try {
    // 1. Load config
    const config = await loadConfig(projectPath);

    // 2. Build context
    const builder = new ContextBuilder(config);
    const context = await builder.build(projectPath);

    // 3. Analyze with LLM
    const provider = createProvider(config);
    const result = await provider.analyze(context, "analyze");

    // 4. Output
    if (options.json) {
      console.log(renderJson(result, context));
    } else {
      console.log(renderTerminal(result, context));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      // If API key error, suggest running beacon init
      if (error.message.includes("API key")) {
        console.error("\nRun 'beacon init' to configure your API key.");
      }
    }
    process.exit(1);
  }
}
