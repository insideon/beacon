import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMProvider, AnalysisResult } from "../types.js";
import { ProjectContext } from "../../context/types.js";
import { renderPrompt, parseAnalysisResult } from "./base.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class GoogleProvider implements LLMProvider {
  name = "google";
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model || "gemini-2.5-flash";
  }

  async analyze(context: ProjectContext, promptType: string): Promise<AnalysisResult> {
    const promptPath = join(__dirname, "../prompts", `${promptType}.md`);
    let template: string;
    try {
      template = readFileSync(promptPath, "utf-8");
    } catch (err) {
      throw new Error(
        `Failed to load prompt template "${promptType}": ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const prompt = renderPrompt(template, context);
    const genModel = this.client.getGenerativeModel({ model: this.model });
    const result = await genModel.generateContent(prompt);
    const text = result.response.text();

    if (!text) {
      throw new Error("Google Gemini API returned no content");
    }

    return parseAnalysisResult(text);
  }
}
