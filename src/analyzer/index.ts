import { LLMProvider } from "./types.js";
import { ClaudeProvider } from "./providers/claude.js";
import { OpenAIProvider } from "./providers/openai.js";
import { GoogleProvider } from "./providers/google.js";
import { CopilotProvider } from "./providers/copilot.js";
import { OpenRouterProvider } from "./providers/openrouter.js";
import { BeaconConfig } from "../config/types.js";

export function createProvider(config: BeaconConfig): LLMProvider {
  const { provider, apiKey, model } = config.llm;

  switch (provider) {
    case "claude":
      if (!apiKey)
        throw new Error(
          "API key required for Claude. Set llm.apiKey in .beaconrc.json or $ANTHROPIC_API_KEY"
        );
      return new ClaudeProvider(apiKey, model);
    case "openai":
      if (!apiKey)
        throw new Error(
          "API key required for OpenAI. Set llm.apiKey in .beaconrc.json or $OPENAI_API_KEY"
        );
      return new OpenAIProvider(apiKey, model);
    case "google":
      if (!apiKey)
        throw new Error("API key required for Google. Set llm.apiKey in .beaconrc.json or $GEMINI_API_KEY");
      return new GoogleProvider(apiKey, model);
    case "copilot":
      if (!apiKey)
        throw new Error("API key required for GitHub Copilot. Set llm.apiKey in .beaconrc.json or provide a GitHub token");
      return new CopilotProvider(apiKey, model);
    case "openrouter":
      if (!apiKey)
        throw new Error("API key required for OpenRouter. Set llm.apiKey in .beaconrc.json or $OPENROUTER_API_KEY");
      return new OpenRouterProvider(apiKey, model);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
