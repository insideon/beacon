import Anthropic from "@anthropic-ai/sdk";
import { BaseProvider } from "./base.js";

export class ClaudeProvider extends BaseProvider {
  name = "claude";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    super();
    this.client = new Anthropic({ apiKey });
    this.model = model || "claude-sonnet-4-6";
  }

  protected async callApi(prompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("Anthropic API returned no text content in response");
    }

    return textContent.text;
  }
}
