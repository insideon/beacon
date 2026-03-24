import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContextBuilder } from "../builder.js";
import type { BeaconConfig } from "../../config/types.js";
import type { GitData } from "../../collectors/git.js";
import type { CodeData } from "../../collectors/code.js";
import type { ConfigData } from "../../collectors/config.js";
import type { DocsData } from "../../collectors/docs.js";

const DEFAULT_CONFIG: BeaconConfig = {
  llm: { provider: "claude", model: "claude-sonnet-4-6" },
  analyze: {
    include: ["**/*"],
    exclude: ["node_modules", "dist", ".git"],
    maxDepth: 5,
  },
};

// Spy on process.stderr.write to verify warnings
let stderrOutput: string[] = [];
let originalWrite: typeof process.stderr.write;

beforeEach(() => {
  stderrOutput = [];
  originalWrite = process.stderr.write.bind(process.stderr);
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderrOutput.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ContextBuilder", () => {
  describe("constructor", () => {
    it("can be instantiated with a BeaconConfig", () => {
      const builder = new ContextBuilder(DEFAULT_CONFIG);
      expect(builder).toBeDefined();
    });
  });

  describe("build", () => {
    it("returns a ProjectContext with the correct shape", async () => {
      // Use a real temp path for a minimal project
      const { mkdtemp, rm, writeFile } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-test-"));
      try {
        // Minimal project: just a package.json and README
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({
            name: "test-project",
            version: "1.0.0",
            description: "A test project for builder tests",
          })
        );
        await writeFile(
          join(tempDir, "README.md"),
          "# test-project\n\nA test project for builder tests.\n"
        );

        const builder = new ContextBuilder(DEFAULT_CONFIG);
        const context = await builder.build(tempDir);

        expect(context).toHaveProperty("project");
        expect(context).toHaveProperty("activity");
        expect(context).toHaveProperty("health");
        expect(context).toHaveProperty("docs");

        expect(context.project).toHaveProperty("name");
        expect(context.project).toHaveProperty("purpose");
        expect(context.project).toHaveProperty("techStack");

        expect(context.activity).toHaveProperty("recentCommits");
        expect(context.activity).toHaveProperty("activeBranches");
        expect(context.activity).toHaveProperty("uncommittedChanges");

        expect(context.health).toHaveProperty("todos");
        expect(context.health).toHaveProperty("outdatedDeps");

        expect(context.docs).toHaveProperty("hasReadme");
        expect(context.docs).toHaveProperty("hasChangelog");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("uses package.json name as project.name", async () => {
      const { mkdtemp, rm, writeFile } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-name-"));
      try {
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({ name: "my-awesome-project", version: "1.0.0" })
        );

        const builder = new ContextBuilder(DEFAULT_CONFIG);
        const context = await builder.build(tempDir);

        expect(context.project.name).toBe("my-awesome-project");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("falls back to directory name when no package.json", async () => {
      const { mkdtemp, rm } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");
      const { basename } = await import("path");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-dirname-"));
      try {
        const builder = new ContextBuilder(DEFAULT_CONFIG);
        const context = await builder.build(tempDir);

        expect(context.project.name).toBe(basename(tempDir));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("derives project.purpose from README description", async () => {
      const { mkdtemp, rm, writeFile } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-purpose-"));
      try {
        await writeFile(
          join(tempDir, "README.md"),
          "# My Project\n\nThis is a fantastic tool for doing things.\n"
        );
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({ name: "my-project", version: "1.0.0" })
        );

        const builder = new ContextBuilder(DEFAULT_CONFIG);
        const context = await builder.build(tempDir);

        expect(context.project.purpose).toContain("fantastic tool");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("returns empty purpose when no README and no description", async () => {
      const { mkdtemp, rm, writeFile } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-nopurpose-"));
      try {
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({ name: "minimal", version: "1.0.0" })
        );

        const builder = new ContextBuilder(DEFAULT_CONFIG);
        const context = await builder.build(tempDir);

        expect(context.project.purpose).toBe("");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("includes TypeScript in techStack for TS projects", async () => {
      const { mkdtemp, rm, writeFile } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-ts-"));
      try {
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({
            name: "ts-project",
            version: "1.0.0",
            devDependencies: { typescript: "^5.0.0" },
          })
        );
        await writeFile(join(tempDir, "tsconfig.json"), JSON.stringify({}));

        const builder = new ContextBuilder(DEFAULT_CONFIG);
        const context = await builder.build(tempDir);

        expect(context.project.techStack).toContain("TypeScript");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("detects README presence in docs", async () => {
      const { mkdtemp, rm, writeFile } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-readme-"));
      try {
        await writeFile(join(tempDir, "README.md"), "# Hello\n\nWorld.\n");

        const builder = new ContextBuilder(DEFAULT_CONFIG);
        const context = await builder.build(tempDir);

        expect(context.docs.hasReadme).toBe(true);
        expect(context.docs.hasChangelog).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("detects CHANGELOG presence in docs", async () => {
      const { mkdtemp, rm, writeFile } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-changelog-"));
      try {
        await writeFile(join(tempDir, "CHANGELOG.md"), "# Changelog\n\n## v1.0.0\n- Initial release\n");

        const builder = new ContextBuilder(DEFAULT_CONFIG);
        const context = await builder.build(tempDir);

        expect(context.docs.hasChangelog).toBe(true);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("returns empty arrays when collectors fail", async () => {
      // We'll mock the GitCollector's collect to fail
      const { GitCollector } = await import("../../collectors/git.js");
      vi.spyOn(GitCollector.prototype, "collect").mockRejectedValue(
        new Error("git not available")
      );

      const { mkdtemp, rm } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-fail-"));
      try {
        const builder = new ContextBuilder(DEFAULT_CONFIG);
        const context = await builder.build(tempDir);

        // Should not throw, git-related fields should be empty
        expect(context.activity.recentCommits).toEqual([]);
        expect(context.activity.activeBranches).toEqual([]);
        expect(context.activity.uncommittedChanges).toEqual([]);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
        vi.restoreAllMocks();
      }
    });

    it("logs a warning to stderr when a collector fails", async () => {
      const { GitCollector } = await import("../../collectors/git.js");
      vi.spyOn(GitCollector.prototype, "collect").mockRejectedValue(
        new Error("git not available")
      );

      const { mkdtemp, rm } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-warn-"));
      try {
        const builder = new ContextBuilder(DEFAULT_CONFIG);
        await builder.build(tempDir);

        const warnings = stderrOutput.join("");
        expect(warnings).toContain("git");
        expect(warnings).toContain("Warning");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
        vi.restoreAllMocks();
      }
    });

    it("runs collectors in parallel (all start before any completes)", async () => {
      const callOrder: string[] = [];
      const resolveOrder: string[] = [];

      const { GitCollector } = await import("../../collectors/git.js");
      const { CodeCollector } = await import("../../collectors/code.js");
      const { ConfigCollector } = await import("../../collectors/config.js");
      const { DocsCollector } = await import("../../collectors/docs.js");

      // Track when each collector starts
      function makeDelay<T>(name: string, delay: number, result: T): (_path: string) => Promise<T> {
        return async (_path: string): Promise<T> => {
          callOrder.push(name);
          await new Promise((r) => setTimeout(r, delay));
          resolveOrder.push(name);
          return result;
        };
      }

      type CR<T> = import("../../collectors/types.js").CollectorResult<T>;

      const gitResult: CR<GitData> = {
        source: "git",
        data: { recentCommits: [], activeBranches: [], uncommittedChanges: [], commitFrequency: { daily: 0, weekly: 0, monthly: 0 } },
        metadata: { collectedAt: new Date(), duration: 0 },
      };
      const codeResult: CR<CodeData> = {
        source: "code",
        data: { files: [], todos: [], summary: { totalFiles: 0, totalLines: 0, languages: {} } },
        metadata: { collectedAt: new Date(), duration: 0 },
      };
      const configResult: CR<ConfigData> = {
        source: "config",
        data: { packageJson: { name: "parallel-test", version: "1.0.0", dependencies: {}, devDependencies: {}, scripts: {} }, hasTypescript: false, hasEslint: false, hasPrettier: false },
        metadata: { collectedAt: new Date(), duration: 0 },
      };
      const docsResult: CR<DocsData> = {
        source: "docs",
        data: { readme: { exists: false }, changelog: { exists: false }, contributing: { exists: false }, license: { exists: false } },
        metadata: { collectedAt: new Date(), duration: 0 },
      };

      vi.spyOn(GitCollector.prototype, "collect").mockImplementation(makeDelay("git", 30, gitResult));
      vi.spyOn(CodeCollector.prototype, "collect").mockImplementation(makeDelay("code", 20, codeResult));
      vi.spyOn(ConfigCollector.prototype, "collect").mockImplementation(makeDelay("config", 10, configResult));
      vi.spyOn(DocsCollector.prototype, "collect").mockImplementation(makeDelay("docs", 15, docsResult));

      const { mkdtemp, rm } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tempDir = await mkdtemp(join(tmpdir(), "beacon-builder-parallel-"));
      try {
        const builder = new ContextBuilder(DEFAULT_CONFIG);
        await builder.build(tempDir);

        // All 4 collectors should have been called
        expect(callOrder).toHaveLength(4);
        // They all start before any finishes (parallel) — config should finish first (10ms)
        // and git last (30ms), but all start in quick succession
        expect(callOrder).toContain("git");
        expect(callOrder).toContain("code");
        expect(callOrder).toContain("config");
        expect(callOrder).toContain("docs");

        // The resolve order should reflect delay order (config < docs < code < git)
        expect(resolveOrder[0]).toBe("config");
        expect(resolveOrder[resolveOrder.length - 1]).toBe("git");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
        vi.restoreAllMocks();
      }
    });
  });
});
