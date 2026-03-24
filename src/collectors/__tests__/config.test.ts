import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { ConfigCollector } from "../config.js";

let tempDir: string;
let minimalDir: string;
let emptyDir: string;

beforeAll(async () => {
  // Full project directory
  tempDir = await mkdtemp(join(tmpdir(), "beacon-config-test-"));

  await writeFile(
    join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "my-test-project",
        version: "1.2.3",
        description: "A test project for config collector",
        dependencies: {
          chalk: "^5.3.0",
          commander: "^12.0.0",
        },
        devDependencies: {
          typescript: "^5.5.4",
          vitest: "^2.0.5",
          prettier: "^3.0.0",
          eslint: "^9.0.0",
        },
        scripts: {
          build: "tsup",
          test: "vitest run",
          lint: "eslint .",
        },
      },
      null,
      2
    )
  );

  await writeFile(
    join(tempDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          strict: true,
        },
      },
      null,
      2
    )
  );

  await writeFile(
    join(tempDir, ".prettierrc"),
    JSON.stringify({ semi: false, singleQuote: true }, null, 2)
  );

  await writeFile(
    join(tempDir, ".eslintrc.json"),
    JSON.stringify({ extends: ["eslint:recommended"] }, null, 2)
  );

  // Minimal project — only package.json, no tsconfig, no eslint, no prettier
  minimalDir = await mkdtemp(join(tmpdir(), "beacon-config-minimal-"));
  await writeFile(
    join(minimalDir, "package.json"),
    JSON.stringify(
      {
        name: "minimal-project",
        version: "0.0.1",
        dependencies: {},
        devDependencies: {},
        scripts: { start: "node index.js" },
      },
      null,
      2
    )
  );

  // Empty directory (no config files at all)
  emptyDir = await mkdtemp(join(tmpdir(), "beacon-config-empty-"));
});

afterAll(async () => {
  await Promise.all([
    rm(tempDir, { recursive: true, force: true }),
    rm(minimalDir, { recursive: true, force: true }),
    rm(emptyDir, { recursive: true, force: true }),
  ]);
});

describe("ConfigCollector", () => {
  it("has the correct name", () => {
    const collector = new ConfigCollector();
    expect(collector.name).toBe("config");
  });

  it("returns a CollectorResult with correct shape", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(tempDir);

    expect(result).toHaveProperty("source", "config");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("metadata");
    expect(result.metadata.collectedAt).toBeInstanceOf(Date);
    expect(typeof result.metadata.duration).toBe("number");
  });

  it("parses package.json correctly", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.packageJson).toBeDefined();
    expect(result.data.packageJson?.name).toBe("my-test-project");
    expect(result.data.packageJson?.version).toBe("1.2.3");
    expect(result.data.packageJson?.description).toBe(
      "A test project for config collector"
    );
  });

  it("collects dependencies", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.packageJson?.dependencies).toHaveProperty("chalk");
    expect(result.data.packageJson?.dependencies).toHaveProperty("commander");
  });

  it("collects devDependencies", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.packageJson?.devDependencies).toHaveProperty(
      "typescript"
    );
    expect(result.data.packageJson?.devDependencies).toHaveProperty("vitest");
  });

  it("collects scripts", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.packageJson?.scripts).toHaveProperty("build", "tsup");
    expect(result.data.packageJson?.scripts).toHaveProperty("test");
  });

  it("detects TypeScript via tsconfig.json", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.hasTypescript).toBe(true);
  });

  it("detects ESLint via dependency", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.hasEslint).toBe(true);
  });

  it("detects Prettier via dependency", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.hasPrettier).toBe(true);
  });

  it("returns packageJson as undefined for empty directory", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(emptyDir);

    expect(result.data.packageJson).toBeUndefined();
    expect(result.data.hasTypescript).toBe(false);
    expect(result.data.hasEslint).toBe(false);
    expect(result.data.hasPrettier).toBe(false);
  });

  it("returns false for tools not present in minimal project", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(minimalDir);

    expect(result.data.hasTypescript).toBe(false);
    expect(result.data.hasEslint).toBe(false);
    expect(result.data.hasPrettier).toBe(false);
    expect(result.data.packageJson?.name).toBe("minimal-project");
  });

  it("detects TypeScript via devDependency (no tsconfig)", async () => {
    const tsDepDir = await mkdtemp(
      join(tmpdir(), "beacon-config-tsdep-")
    );
    try {
      await writeFile(
        join(tsDepDir, "package.json"),
        JSON.stringify(
          {
            name: "ts-dep-project",
            version: "1.0.0",
            devDependencies: { typescript: "^5.0.0" },
          },
          null,
          2
        )
      );
      const collector = new ConfigCollector();
      const result = await collector.collect(tsDepDir);
      expect(result.data.hasTypescript).toBe(true);
    } finally {
      await rm(tsDepDir, { recursive: true, force: true });
    }
  });

  it("provides empty objects for missing fields", async () => {
    const collector = new ConfigCollector();
    const result = await collector.collect(minimalDir);

    // minimal package.json has empty dependencies
    expect(result.data.packageJson?.dependencies).toEqual({});
    expect(result.data.packageJson?.devDependencies).toEqual({});
  });
});
