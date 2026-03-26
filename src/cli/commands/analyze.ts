import { loadConfig, resolveApiKey } from "../../config/loader.js";
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
    const config = await loadConfig(projectPath);
    const apiKey = await resolveApiKey(config.llm.provider, config.llm.apiKey);

    if (!apiKey) {
      console.error(
        `No API key found for ${config.llm.provider}. Run 'beacon login' to set up your provider.`
      );
      process.exit(1);
    }

    const builder = new ContextBuilder(config);
    const context = await builder.build(projectPath);
    const provider = createProvider(config.llm.provider, apiKey, config.llm.model);
    const result = await provider.analyze(context, "analyze");

    if (options.json) {
      console.log(renderJson(result, context));
    } else {
      console.log(renderTerminal(result, context));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}
