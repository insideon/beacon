import { LLMProvider } from "./types.js";
import { ClaudeProvider } from "./providers/claude.js";
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
      throw new Error("OpenAI provider not yet implemented");
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
