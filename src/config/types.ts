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

export type SupportedLanguage =
  | "en" | "ko" | "ja" | "zh" | "es"
  | "fr" | "de" | "pt" | "ru" | "ar"
  | "hi" | "vi" | "th" | "id" | "tr";

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  ko: "한국어 (Korean)",
  ja: "日本語 (Japanese)",
  zh: "中文 (Chinese)",
  es: "Español (Spanish)",
  fr: "Français (French)",
  de: "Deutsch (German)",
  pt: "Português (Portuguese)",
  ru: "Русский (Russian)",
  ar: "العربية (Arabic)",
  hi: "हिन्दी (Hindi)",
  vi: "Tiếng Việt (Vietnamese)",
  th: "ไทย (Thai)",
  id: "Bahasa Indonesia (Indonesian)",
  tr: "Türkçe (Turkish)",
};

export interface BeaconConfig {
  llm: LLMConfig;
  analyze: AnalyzeConfig;
  gate?: GateConfig;
  consensus?: ConsensusConfig;
  language?: SupportedLanguage;
}
