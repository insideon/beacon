export interface LLMConfig {
  provider: "claude" | "openai" | "ollama";
  model?: string;
  apiKey?: string; // supports $ENV_VAR syntax
}

export interface AnalyzeConfig {
  include: string[];
  exclude: string[];
  maxDepth: number;
}

export interface BeaconConfig {
  llm: LLMConfig;
  analyze: AnalyzeConfig;
}
