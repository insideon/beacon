import { LLMProvider } from "./types.js";
import { ClaudeProvider } from "./providers/claude.js";
import { OpenAIProvider } from "./providers/openai.js";
import { GoogleProvider } from "./providers/google.js";
import { CopilotProvider } from "./providers/copilot.js";
import { OpenRouterProvider } from "./providers/openrouter.js";

export function createProvider(provider: string, apiKey: string, model?: string): LLMProvider {
  switch (provider) {
    case "claude":
      return new ClaudeProvider(apiKey, model);
    case "openai":
      return new OpenAIProvider(apiKey, model);
    case "google":
      return new GoogleProvider(apiKey, model);
    case "copilot":
      return new CopilotProvider(apiKey, model);
    case "openrouter":
      return new OpenRouterProvider(apiKey, model);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
