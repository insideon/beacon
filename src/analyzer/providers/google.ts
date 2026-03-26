import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseProvider } from "./base.js";

export class GoogleProvider extends BaseProvider {
  name = "google";
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    super();
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model || "gemini-2.5-flash";
  }

  protected async callApi(prompt: string): Promise<string> {
    const genModel = this.client.getGenerativeModel({ model: this.model });
    const result = await genModel.generateContent(prompt);
    const text = result.response.text();

    if (!text) {
      throw new Error("Google Gemini API returned no content");
    }

    return text;
  }
}
