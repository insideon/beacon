import OpenAI from "openai";
import { BaseProvider } from "./base.js";

export class CopilotProvider extends BaseProvider {
  name = "copilot";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    super();
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.githubcopilot.com",
      defaultHeaders: {
        "Copilot-Integration-Id": "vscode-chat",
      },
    });
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
      throw new Error("GitHub Copilot API returned no content in response");
    }

    return content;
  }
}
