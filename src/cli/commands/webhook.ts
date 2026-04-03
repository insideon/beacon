import chalk from "chalk";
import { loadConfig, resolveApiKey } from "../../config/loader.js";
import { ContextBuilder } from "../../context/builder.js";
import { createProvider } from "../../analyzer/index.js";
import { execSync } from "child_process";
import { createSpinner } from "../spinner.js";
import { handleCliError } from "../errors.js";
import { buildSnapshot, recordSnapshot, getCurrentBranch } from "../../history/store.js";
import type { AnalysisResult, Recommendation } from "../../analyzer/types.js";

function getHeadCommit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function formatSlackPayload(result: AnalysisResult, projectName: string): object {
  const priorityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
  };

  const topItems = result.todaysFocus
    .slice(0, 5)
    .map(
      (r: Recommendation, i: number) =>
        `${i + 1}. ${priorityEmoji[r.priority] ?? "⚪"} *[${r.priority}]* ${r.title}\n    ${r.description}`
    )
    .join("\n");

  return {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `🔍 Beacon — ${projectName}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: result.summary },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Today's Focus*\n${topItems || "_No items_"}`,
        },
      },
    ],
  };
}

function formatDiscordPayload(result: AnalysisResult, projectName: string): object {
  const priorityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
  };

  const topItems = result.todaysFocus
    .slice(0, 5)
    .map(
      (r: Recommendation, i: number) =>
        `${i + 1}. ${priorityEmoji[r.priority] ?? "⚪"} **[${r.priority}]** ${r.title}\n    ${r.description}`
    )
    .join("\n");

  return {
    embeds: [
      {
        title: `🔍 Beacon — ${projectName}`,
        description: result.summary,
        fields: [
          {
            name: "Today's Focus",
            value: topItems || "_No items_",
          },
        ],
        color: 0x3498db,
      },
    ],
  };
}

async function sendWebhook(url: string, payload: object): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
  }
}

function detectPlatform(url: string): "slack" | "discord" | "unknown" {
  if (url.includes("hooks.slack.com")) return "slack";
  if (url.includes("discord.com/api/webhooks")) return "discord";
  return "unknown";
}

export async function webhookCommand(options: {
  url: string;
  json?: boolean;
  verbose?: boolean;
  noCache?: boolean;
  platform?: string;
}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = options.verbose ?? false;
  const isJson = options.json ?? false;
  const log = (msg: string) => {
    if (verbose) console.error(`[verbose] ${msg}`);
  };

  try {
    const config = await loadConfig(projectPath);
    const apiKey = await resolveApiKey(config.llm.provider, config.llm.apiKey);

    if (!apiKey) {
      console.error(`No API key found for ${config.llm.provider}. Run 'beacon login' to set up your provider.`);
      process.exit(1);
    }

    const spinner = !isJson ? createSpinner() : null;

    spinner?.start("Collecting project data...");
    const builder = new ContextBuilder(config);
    const context = await builder.build(projectPath, verbose);
    spinner?.succeed("Project data collected");

    const commitHash = getHeadCommit();
    const provider = createProvider(config.llm.provider, apiKey, config.llm.model);

    spinner?.start("Analyzing with AI...");
    const result = await provider.analyze(context, "analyze", config.language);
    spinner?.succeed("Analysis complete");

    // Record snapshot
    if (commitHash) {
      const snapshot = buildSnapshot(context, result, commitHash, getCurrentBranch());
      await recordSnapshot(snapshot);
    }

    // Detect platform
    const platform = options.platform ?? detectPlatform(options.url);
    log(`Detected platform: ${platform}`);

    let payload: object;
    if (platform === "discord") {
      payload = formatDiscordPayload(result, context.project.name);
    } else {
      // Default to Slack format
      payload = formatSlackPayload(result, context.project.name);
    }

    if (isJson) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    spinner?.start("Sending to webhook...");
    await sendWebhook(options.url, payload);
    spinner?.succeed(chalk.green("Sent to webhook successfully!"));
  } catch (error) {
    handleCliError(error, verbose);
  }
}
