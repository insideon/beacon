import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { LANGUAGE_NAMES, type SupportedLanguage } from "../../config/types.js";

export async function languageCommand(): Promise<void> {
  const configPath = join(process.cwd(), ".beaconrc.json");

  // Load existing config
  let config: Record<string, unknown> = {};
  try {
    const content = await readFile(configPath, "utf-8");
    config = JSON.parse(content);
  } catch {
    // No config file — will create one
  }

  const currentLang = (config.language as string) ?? "en";

  const choices = Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
    name: code === currentLang ? `${name} ${chalk.green("● current")}` : name,
    value: code,
  }));

  try {
    const language = await select({
      message: "Select output language:",
      choices,
    });

    config.language = language;
    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    console.log(`\n✓ Language set to ${LANGUAGE_NAMES[language as SupportedLanguage]}. Analysis output will now be in this language.`);
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") {
      process.exit(0);
    }
    throw error;
  }
}
