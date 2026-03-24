import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { loadConfig } from "../loader.js";

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "beacon-config-test-"));
});

afterAll(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("loadConfig", () => {
  describe("defaults", () => {
    it("returns default config when no .beaconrc.json exists", async () => {
      const config = await loadConfig(tempDir);

      expect(config.llm.provider).toBe("claude");
      expect(config.llm.model).toBe("claude-sonnet-4-6");
      expect(config.analyze.include).toEqual(["**/*"]);
      expect(config.analyze.exclude).toEqual([
        "node_modules",
        "dist",
        ".git",
        "build",
        "coverage",
      ]);
      expect(config.analyze.maxDepth).toBe(5);
    });

    it("returns a new object each call (not a shared reference)", async () => {
      const config1 = await loadConfig(tempDir);
      const config2 = await loadConfig(tempDir);
      expect(config1).not.toBe(config2);
    });
  });

  describe("loading a config file", () => {
    let configDir: string;

    beforeEach(async () => {
      configDir = await mkdtemp(join(tmpdir(), "beacon-config-load-"));
    });

    afterEach(async () => {
      await rm(configDir, { recursive: true, force: true });
    });

    it("reads a complete .beaconrc.json file", async () => {
      const configContent = {
        llm: {
          provider: "openai",
          model: "gpt-4o",
          apiKey: "my-api-key",
        },
        analyze: {
          include: ["src/**/*"],
          exclude: ["node_modules"],
          maxDepth: 3,
        },
      };
      await writeFile(
        join(configDir, ".beaconrc.json"),
        JSON.stringify(configContent)
      );

      const config = await loadConfig(configDir);

      expect(config.llm.provider).toBe("openai");
      expect(config.llm.model).toBe("gpt-4o");
      expect(config.llm.apiKey).toBe("my-api-key");
      expect(config.analyze.include).toEqual(["src/**/*"]);
      expect(config.analyze.exclude).toEqual(["node_modules"]);
      expect(config.analyze.maxDepth).toBe(3);
    });

    it("merges partial config with defaults (llm only)", async () => {
      const configContent = {
        llm: {
          provider: "ollama",
          model: "llama3",
        },
      };
      await writeFile(
        join(configDir, ".beaconrc.json"),
        JSON.stringify(configContent)
      );

      const config = await loadConfig(configDir);

      expect(config.llm.provider).toBe("ollama");
      expect(config.llm.model).toBe("llama3");
      // analyze should be default
      expect(config.analyze.include).toEqual(["**/*"]);
      expect(config.analyze.maxDepth).toBe(5);
    });

    it("merges partial config with defaults (analyze only)", async () => {
      const configContent = {
        analyze: {
          include: ["src/**/*.ts"],
          exclude: ["node_modules", "dist"],
          maxDepth: 10,
        },
      };
      await writeFile(
        join(configDir, ".beaconrc.json"),
        JSON.stringify(configContent)
      );

      const config = await loadConfig(configDir);

      // llm should be default
      expect(config.llm.provider).toBe("claude");
      expect(config.llm.model).toBe("claude-sonnet-4-6");
      expect(config.analyze.include).toEqual(["src/**/*.ts"]);
      expect(config.analyze.maxDepth).toBe(10);
    });

    it("handles empty config object with all defaults", async () => {
      await writeFile(join(configDir, ".beaconrc.json"), "{}");

      const config = await loadConfig(configDir);

      expect(config.llm.provider).toBe("claude");
      expect(config.analyze.maxDepth).toBe(5);
    });
  });

  describe("env var resolution", () => {
    let configDir: string;
    const originalEnv = { ...process.env };

    beforeEach(async () => {
      configDir = await mkdtemp(join(tmpdir(), "beacon-config-env-"));
    });

    afterEach(async () => {
      await rm(configDir, { recursive: true, force: true });
      // Restore env vars
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) {
          delete process.env[key];
        }
      }
      Object.assign(process.env, originalEnv);
    });

    it("resolves $ENV_VAR in apiKey", async () => {
      process.env["TEST_API_KEY"] = "secret-api-key-value";

      const configContent = {
        llm: {
          provider: "openai",
          model: "gpt-4",
          apiKey: "$TEST_API_KEY",
        },
      };
      await writeFile(
        join(configDir, ".beaconrc.json"),
        JSON.stringify(configContent)
      );

      const config = await loadConfig(configDir);
      expect(config.llm.apiKey).toBe("secret-api-key-value");
    });

    it("leaves $ENV_VAR intact when env var is not set", async () => {
      delete process.env["UNSET_BEACON_KEY"];

      const configContent = {
        llm: {
          provider: "openai",
          apiKey: "$UNSET_BEACON_KEY",
        },
      };
      await writeFile(
        join(configDir, ".beaconrc.json"),
        JSON.stringify(configContent)
      );

      const config = await loadConfig(configDir);
      expect(config.llm.apiKey).toBe("$UNSET_BEACON_KEY");
    });

    it("does not modify non-$ strings", async () => {
      const configContent = {
        llm: {
          provider: "claude",
          apiKey: "plain-key-value",
        },
      };
      await writeFile(
        join(configDir, ".beaconrc.json"),
        JSON.stringify(configContent)
      );

      const config = await loadConfig(configDir);
      expect(config.llm.apiKey).toBe("plain-key-value");
    });

    it("resolves $ENV_VAR in model field", async () => {
      process.env["MY_MODEL"] = "claude-opus-4-5";

      const configContent = {
        llm: {
          provider: "claude",
          model: "$MY_MODEL",
        },
      };
      await writeFile(
        join(configDir, ".beaconrc.json"),
        JSON.stringify(configContent)
      );

      const config = await loadConfig(configDir);
      expect(config.llm.model).toBe("claude-opus-4-5");
    });
  });

  describe("error handling", () => {
    let configDir: string;

    beforeEach(async () => {
      configDir = await mkdtemp(join(tmpdir(), "beacon-config-err-"));
    });

    afterEach(async () => {
      await rm(configDir, { recursive: true, force: true });
    });

    it("falls back to defaults when .beaconrc.json contains invalid JSON", async () => {
      await writeFile(join(configDir, ".beaconrc.json"), "{ invalid json }");

      const config = await loadConfig(configDir);

      expect(config.llm.provider).toBe("claude");
      expect(config.analyze.maxDepth).toBe(5);
    });

    it("returns defaults for a path with no config file", async () => {
      const config = await loadConfig("/tmp/path-that-has-no-config-file");

      expect(config.llm.provider).toBe("claude");
      expect(config.analyze.include).toEqual(["**/*"]);
    });
  });
});
