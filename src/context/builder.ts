import { GitCollector } from "../collectors/git.js";
import type { GitData } from "../collectors/git.js";
import { CodeCollector } from "../collectors/code.js";
import type { CodeData } from "../collectors/code.js";
import { ConfigCollector } from "../collectors/config.js";
import type { ConfigData } from "../collectors/config.js";
import { DocsCollector } from "../collectors/docs.js";
import type { DocsData } from "../collectors/docs.js";
import type { CollectorResult } from "../collectors/types.js";
import type { ProjectContext } from "./types.js";
import type { BeaconConfig } from "../config/types.js";
import { basename } from "path";

export class ContextBuilder {
  private gitCollector: GitCollector;
  private codeCollector: CodeCollector;
  private configCollector: ConfigCollector;
  private docsCollector: DocsCollector;

  constructor(config: BeaconConfig) {
    this.gitCollector = new GitCollector();
    this.codeCollector = new CodeCollector(
      config.analyze.include,
      config.analyze.exclude
    );
    this.configCollector = new ConfigCollector();
    this.docsCollector = new DocsCollector();
  }

  async build(projectPath: string): Promise<ProjectContext> {
    // Run all collectors in parallel
    const [gitResult, codeResult, configResult, docsResult] =
      await Promise.allSettled([
        this.gitCollector.collect(projectPath),
        this.codeCollector.collect(projectPath),
        this.configCollector.collect(projectPath),
        this.docsCollector.collect(projectPath),
      ]);

    // Helper to extract data or log warning and return null
    function extractOrWarn<T>(
      result: PromiseSettledResult<CollectorResult<T>>,
      collectorName: string
    ): T | null {
      if (result.status === "fulfilled") {
        return result.value.data;
      }
      const err = result.reason instanceof Error ? result.reason.message : String(result.reason);
      let hint = "";
      if (collectorName === "git") {
        hint = " Not a git repository? Git data will be skipped.";
      }
      process.stderr.write(`[beacon] Warning: ${collectorName} collector failed: ${err}.${hint}\n`);
      return null;
    }

    const gitData = extractOrWarn<GitData>(gitResult, "git");
    const codeData = extractOrWarn<CodeData>(codeResult, "code");
    const configData = extractOrWarn<ConfigData>(configResult, "config");
    const docsData = extractOrWarn<DocsData>(docsResult, "docs");

    // Derive project.name: prefer package.json name, fall back to directory name
    const projectName =
      configData?.packageJson?.name || basename(projectPath);

    // Derive project.purpose: prefer README description, fall back to package.json description
    const projectPurpose =
      docsData?.readme?.description ??
      configData?.packageJson?.description ??
      "";

    // Derive techStack from config (TypeScript flag) and code (language counts)
    const techStack: string[] = [];
    if (configData?.hasTypescript) {
      techStack.push("TypeScript");
    }
    if (codeData?.summary?.languages) {
      for (const lang of Object.keys(codeData.summary.languages)) {
        if (lang !== "TypeScript" && !techStack.includes(lang)) {
          techStack.push(lang);
        }
      }
    }
    if (configData?.hasEslint) {
      techStack.push("ESLint");
    }
    if (configData?.hasPrettier) {
      techStack.push("Prettier");
    }

    // Determine the most recent doc update
    let lastDocUpdate: Date | undefined;
    if (docsData) {
      const dates: Date[] = [];
      if (docsData.readme?.lastModified) dates.push(docsData.readme.lastModified);
      if (docsData.changelog?.lastModified) dates.push(docsData.changelog.lastModified);
      if (docsData.contributing?.lastModified) dates.push(docsData.contributing.lastModified);
      if (dates.length > 0) {
        lastDocUpdate = new Date(Math.max(...dates.map((d) => d.getTime())));
      }
    }

    return {
      project: {
        name: projectName,
        purpose: projectPurpose,
        techStack,
      },
      activity: {
        recentCommits: gitData?.recentCommits ?? [],
        activeBranches: gitData?.activeBranches ?? [],
        uncommittedChanges: gitData?.uncommittedChanges ?? [],
      },
      health: {
        todos: codeData?.todos ?? [],
        outdatedDeps: [],
        testCoverage: undefined,
      },
      docs: {
        hasReadme: docsData?.readme?.exists ?? false,
        hasChangelog: docsData?.changelog?.exists ?? false,
        lastDocUpdate,
      },
    };
  }
}
