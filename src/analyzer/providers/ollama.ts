import { BaseProvider } from "./base.js";

export class OllamaProvider extends BaseProvider {
  name = "ollama";
  private baseUrl: string;
  private model: string;

  constructor(_apiKey: string, model?: string) {
    super();
    this.baseUrl = process.env.OLLAMA_HOST ?? "http://localhost:11434";
    this.model = model || "llama3.1";
  }

  protected async callApi(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          num_predict: 4096,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}. Is Ollama running? (${this.baseUrl})`
      );
    }

    const data = (await response.json()) as { response?: string };
    if (!data.response) {
      throw new Error("Ollama returned no response content");
    }

    return data.response;
  }
}
