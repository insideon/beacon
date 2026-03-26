import OpenAI from "openai";
import { LLMProvider, AnalysisResult } from "../types.js";
import { ProjectContext } from "../../context/types.js";
import { renderPrompt, parseAnalysisResult } from "./base.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class CopilotProvider implements LLMProvider {
  name = "copilot";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.githubcopilot.com",
      defaultHeaders: {
        "Copilot-Integration-Id": "vscode-chat",
      },
    });
    this.model = model || "gpt-4o";
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

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("GitHub Copilot API returned no content in response");
    }

    return parseAnalysisResult(content);
  }
}
