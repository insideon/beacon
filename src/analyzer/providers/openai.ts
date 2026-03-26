import OpenAI from "openai";
import { BaseProvider } from "./base.js";

export class OpenAIProvider extends BaseProvider {
  name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    super();
    this.client = new OpenAI({ apiKey });
    this.model = model || "gpt-4o";
  }

  protected async callApi(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI API returned no content in response");
    }

    return content;
  }
}
