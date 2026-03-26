import { select, password } from "@inquirer/prompts";
import open from "open";
import { loadCredentials, saveCredentials } from "../../auth/credentials.js";

const PROVIDERS = [
  {
    name: "Claude (Anthropic)",
    value: "claude" as const,
    keyPage: "https://console.anthropic.com/settings/keys",
  },
  {
    name: "OpenAI",
    value: "openai" as const,
    keyPage: "https://platform.openai.com/api-keys",
  },
  {
    name: "Google (Gemini)",
    value: "google" as const,
    keyPage: "https://aistudio.google.com/apikey",
  },
  {
    name: "GitHub Copilot",
    value: "copilot" as const,
    keyPage: "https://github.com/settings/copilot",
  },
  {
    name: "OpenRouter",
    value: "openrouter" as const,
    keyPage: "https://openrouter.ai/keys",
  },
];

export async function loginCommand(): Promise<void> {
  const provider = await select({
    message: "Select LLM provider:",
    choices: PROVIDERS.map((p) => ({ name: p.name, value: p.value })),
  });

  const providerInfo = PROVIDERS.find((p) => p.value === provider)!;

  console.log(`\nOpening ${providerInfo.keyPage} ...`);
  await open(providerInfo.keyPage);

  const apiKey = await password({
    message: "Paste your API key:",
    mask: "*",
  });

  if (!apiKey) {
    console.error("No API key provided. Aborted.");
    process.exit(1);
  }

  const creds = await loadCredentials();
  creds.activeProvider = provider;
  creds.providers[provider] = { apiKey };
  await saveCredentials(undefined, creds);

  console.log(`\n✓ Saved! Run 'beacon analyze' to get started.`);
}
