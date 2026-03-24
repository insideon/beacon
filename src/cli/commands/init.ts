import { writeFile, access } from "fs/promises";
import { join } from "path";

const DEFAULT_CONFIG = {
  llm: {
    provider: "claude",
    apiKey: "$ANTHROPIC_API_KEY",
    model: "claude-sonnet-4-6",
  },
  analyze: {
    include: ["**/*"],
    exclude: ["node_modules", "dist", ".git", "build", "coverage"],
    maxDepth: 5,
  },
};

export async function initCommand(): Promise<void> {
  const projectPath = process.cwd();
  const configPath = join(projectPath, ".beaconrc.json");

  // Check if config already exists
  try {
    await access(configPath);
    console.log(`Config already exists at ${configPath}`);
    console.log("Delete it first if you want to re-initialize.");
    return;
  } catch {
    // File does not exist — proceed to create it
  }

  // Write default .beaconrc.json
  const content = JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n";
  await writeFile(configPath, content, "utf-8");

  console.log(`Created ${configPath}`);
  console.log("");
  console.log("Next steps:");
  console.log(
    "  1. Set your Anthropic API key as an environment variable:"
  );
  console.log("");
  console.log("       export ANTHROPIC_API_KEY=your-key-here");
  console.log("");
  console.log(
    "  2. Run 'beacon' to analyze your project."
  );
}
