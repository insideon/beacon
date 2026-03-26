import OpenAI from "openai";
import { BaseProvider } from "./base.js";

export class OpenRouterProvider extends BaseProvider {
  name = "openrouter";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    super();
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/insideon/beacon",
        "X-Title": "Beacon AI",
      },
    });
    this.model = model || "anthropic/claude-sonnet-4";
  }

  protected async callApi(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter API returned no content in response");
    }

    return content;
  }
}
