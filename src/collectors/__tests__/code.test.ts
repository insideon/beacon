import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { CodeCollector } from "../code.js";

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "beacon-code-test-"));

  // Create directory structure
  await mkdir(join(tempDir, "src"), { recursive: true });
  await mkdir(join(tempDir, "src", "utils"), { recursive: true });
  await mkdir(join(tempDir, "node_modules", "some-pkg"), { recursive: true });

  // TypeScript file with TODOs
  await writeFile(
    join(tempDir, "src", "index.ts"),
    [
      "export function hello(): string {",
      "  // TODO: add proper implementation",
      "  return 'hello';",
      "}",
      "",
      "// FIXME: This is broken",
      "export const broken = null;",
    ].join("\n")
  );

  // Another TypeScript file
  await writeFile(
    join(tempDir, "src", "utils", "helpers.ts"),
    [
      "// HACK: Workaround for issue #123",
      "export function hack() {}",
      "",
      "// XXX: Remove before release",
      "export const temp = 42;",
      "",
      "export function add(a: number, b: number): number {",
      "  return a + b;",
      "}",
    ].join("\n")
  );

  // JavaScript file
  await writeFile(
    join(tempDir, "src", "app.js"),
    [
      "const express = require('express');",
      "const app = express();",
      "module.exports = app;",
    ].join("\n")
  );

  // Python file
  await writeFile(
    join(tempDir, "script.py"),
    ["def main():", "    # TODO: implement", "    pass"].join("\n")
  );

  // Markdown file
  await writeFile(
    join(tempDir, "README.md"),
    "# Test Project\n\nA test project.\n"
  );

  // File in node_modules (should be excluded by default)
  await writeFile(
    join(tempDir, "node_modules", "some-pkg", "index.js"),
    "module.exports = {};"
  );
});

afterAll(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("CodeCollector", () => {
  it("has the correct name", () => {
    const collector = new CodeCollector();
    expect(collector.name).toBe("code");
  });

  it("returns a CollectorResult with correct shape", async () => {
    const collector = new CodeCollector();
    const result = await collector.collect(tempDir);

    expect(result).toHaveProperty("source", "code");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("metadata");
    expect(result.metadata.collectedAt).toBeInstanceOf(Date);
    expect(typeof result.metadata.duration).toBe("number");
  });

  it("collects files with path, size, and lines", async () => {
    const collector = new CodeCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.files.length).toBeGreaterThan(0);

    const file = result.data.files[0];
    expect(file).toHaveProperty("path");
    expect(file).toHaveProperty("size");
    expect(file).toHaveProperty("lines");
    expect(typeof file.path).toBe("string");
    expect(typeof file.size).toBe("number");
    expect(typeof file.lines).toBe("number");
    expect(file.size).toBeGreaterThan(0);
    expect(file.lines).toBeGreaterThan(0);
  });

  it("finds TypeScript files", async () => {
    const collector = new CodeCollector();
    const result = await collector.collect(tempDir);

    const tsPaths = result.data.files.map((f) => f.path);
    const hasTsFiles = tsPaths.some((p) => p.endsWith(".ts"));
    expect(hasTsFiles).toBe(true);
  });

  it("excludes node_modules by default", async () => {
    const collector = new CodeCollector();
    const result = await collector.collect(tempDir);

    const paths = result.data.files.map((f) => f.path);
    const hasNodeModules = paths.some((p) => p.includes("node_modules"));
    expect(hasNodeModules).toBe(false);
  });

  it("detects TODO comments", async () => {
    const collector = new CodeCollector();
    const result = await collector.collect(tempDir);

    const todos = result.data.todos.filter((t) => t.type === "TODO");
    expect(todos.length).toBeGreaterThanOrEqual(2); // one in index.ts, one in script.py

    const todo = todos[0];
    expect(todo).toHaveProperty("file");
    expect(todo).toHaveProperty("line");
    expect(todo).toHaveProperty("text");
    expect(todo).toHaveProperty("type", "TODO");
    expect(typeof todo.line).toBe("number");
    expect(todo.line).toBeGreaterThan(0);
  });

  it("detects FIXME comments", async () => {
    const collector = new CodeCollector();
    const result = await collector.collect(tempDir);

    const fixmes = result.data.todos.filter((t) => t.type === "FIXME");
    expect(fixmes.length).toBeGreaterThanOrEqual(1);
    expect(fixmes[0].text).toContain("This is broken");
  });

  it("detects HACK comments", async () => {
    const collector = new CodeCollector();
    const result = await collector.collect(tempDir);

    const hacks = result.data.todos.filter((t) => t.type === "HACK");
    expect(hacks.length).toBeGreaterThanOrEqual(1);
    expect(hacks[0].text).toContain("Workaround");
  });

  it("detects XXX comments", async () => {
    const collector = new CodeCollector();
    const result = await collector.collect(tempDir);

    const xxx = result.data.todos.filter((t) => t.type === "XXX");
    expect(xxx.length).toBeGreaterThanOrEqual(1);
    expect(xxx[0].text).toContain("Remove before release");
  });

  it("provides correct summary totals", async () => {
    const collector = new CodeCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.summary.totalFiles).toBe(result.data.files.length);
    const expectedLines = result.data.files.reduce(
      (sum, f) => sum + f.lines,
      0
    );
    expect(result.data.summary.totalLines).toBe(expectedLines);
  });

  it("detects languages in summary", async () => {
    const collector = new CodeCollector();
    const result = await collector.collect(tempDir);

    expect(result.data.summary.languages).toHaveProperty("TypeScript");
    expect(result.data.summary.languages).toHaveProperty("JavaScript");
    expect(result.data.summary.languages["TypeScript"]).toBeGreaterThanOrEqual(
      2
    );
  });

  it("supports custom include patterns", async () => {
    const collector = new CodeCollector({ include: ["**/*.ts"] });
    const result = await collector.collect(tempDir);

    // Should only find .ts files
    const nonTs = result.data.files.filter((f) => !f.path.endsWith(".ts"));
    expect(nonTs.length).toBe(0);
    expect(result.data.files.length).toBeGreaterThanOrEqual(2);
  });

  it("supports custom exclude patterns", async () => {
    const collector = new CodeCollector({
      include: ["**/*.ts", "**/*.js", "**/*.py", "**/*.md"],
      exclude: ["node_modules/**", "**/*.py"],
    });
    const result = await collector.collect(tempDir);

    const hasPython = result.data.files.some((f) => f.path.endsWith(".py"));
    expect(hasPython).toBe(false);
  });

  it("records correct line numbers for TODO items", async () => {
    const collector = new CodeCollector({ include: ["src/index.ts"] });
    const result = await collector.collect(tempDir);

    const todoInIndex = result.data.todos.find(
      (t) => t.file.includes("index.ts") && t.type === "TODO"
    );
    expect(todoInIndex).toBeDefined();
    expect(todoInIndex?.line).toBe(2); // Line 2 in index.ts
  });
});
