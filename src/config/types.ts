export interface LLMConfig {
  provider: "claude" | "openai" | "google" | "copilot" | "openrouter" | "ollama";
  model?: string;
  apiKey?: string; // supports $ENV_VAR syntax
}

export interface AnalyzeConfig {
  include: string[];
  exclude: string[];
  maxDepth: number;
}

export interface GateConfig {
  minScore?: number;
  maxCritical?: number;
  maxHigh?: number;
  maxVulnerabilities?: number;
}

export interface ConsensusConfig {
  providers: { provider: LLMConfig["provider"]; model?: string }[];
}

export interface BeaconConfig {
  llm: LLMConfig;
  analyze: AnalyzeConfig;
  gate?: GateConfig;
  consensus?: ConsensusConfig;
}
