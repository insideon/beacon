import Anthropic from "@anthropic-ai/sdk";
import { LLMProvider, AnalysisResult } from "../types.js";
import { ProjectContext } from "../../context/types.js";
import { renderPrompt, parseAnalysisResult } from "./base.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ClaudeProvider implements LLMProvider {
  name = "claude";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || "claude-sonnet-4-6";
  }

  async analyze(context: ProjectContext, promptType: string): Promise<AnalysisResult> {
    // Load prompt template from the prompts/ directory (sibling of providers/)
    const promptPath = join(__dirname, "../prompts", `${promptType}.md`);
    let template: string;
    try {
      template = readFileSync(promptPath, "utf-8");
    } catch (err) {
      throw new Error(
        `Failed to load prompt template "${promptType}": ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Render template with context data
    const prompt = renderPrompt(template, context);

    // Call Anthropic API
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text content from response
    const textContent = message.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("Anthropic API returned no text content in response");
    }

    // Parse and validate response
    return parseAnalysisResult(textContent.text);
  }
}
