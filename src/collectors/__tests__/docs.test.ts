import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { DocsCollector } from "../docs.js";

let fullDir: string;
let emptyDir: string;

beforeAll(async () => {
  // Full docs directory
  fullDir = await mkdtemp(join(tmpdir(), "beacon-docs-test-"));

  await writeFile(
    join(fullDir, "README.md"),
    [
      "# My Awesome Project",
      "",
      "This is an AI-powered tool that helps developers.",
      "",
      "## Installation",
      "",
      "Run `npm install`.",
    ].join("\n")
  );

  await writeFile(
    join(fullDir, "CHANGELOG.md"),
    [
      "# Changelog",
      "",
      "## [1.0.0] - 2024-01-01",
      "- Initial release",
    ].join("\n")
  );

  await writeFile(
    join(fullDir, "CONTRIBUTING.md"),
    [
      "# Contributing",
      "",
      "Please open a pull request.",
    ].join("\n")
  );

  await writeFile(
    join(fullDir, "LICENSE"),
    [
      "MIT License",
      "",
      "Copyright (c) 2024 Test",
      "",
      "Permission is hereby granted, free of charge, to any person obtaining a copy",
      "of this software and associated documentation files (the \"Software\"), to deal",
      "in the Software without restriction, including without limitation the rights",
      "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell",
      "copies of the Software, and to permit persons to whom the Software is",
      "furnished to do so, subject to the following conditions:",
      "",
      "The above copyright notice and this permission notice shall be included in all",
      "copies or substantial portions of the Software.",
      "",
      'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
      "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,",
      "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.",
    ].join("\n")
  );

  // Empty directory
  emptyDir = await mkdtemp(join(tmpdir(), "beacon-docs-empty-"));
});

afterAll(async () => {
  await Promise.all([
    rm(fullDir, { recursive: true, force: true }),
    rm(emptyDir, { recursive: true, force: true }),
  ]);
});

describe("DocsCollector", () => {
  it("has the correct name", () => {
    const collector = new DocsCollector();
    expect(collector.name).toBe("docs");
  });

  it("returns a CollectorResult with correct shape", async () => {
    const collector = new DocsCollector();
    const result = await collector.collect(fullDir);

    expect(result).toHaveProperty("source", "docs");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("metadata");
    expect(result.metadata.collectedAt).toBeInstanceOf(Date);
    expect(typeof result.metadata.duration).toBe("number");
  });

  it("detects README.md existence", async () => {
    const collector = new DocsCollector();
    const result = await collector.collect(fullDir);

    expect(result.data.readme.exists).toBe(true);
    expect(result.data.readme.lastModified).toBeInstanceOf(Date);
  });

  it("extracts README description (first paragraph after title)", async () => {
    const collector = new DocsCollector();
    const result = await collector.collect(fullDir);

    expect(result.data.readme.description).toBeDefined();
    expect(result.data.readme.description).toContain(
      "AI-powered tool that helps developers"
    );
  });

  it("detects CHANGELOG.md existence", async () => {
    const collector = new DocsCollector();
    const result = await collector.collect(fullDir);

    expect(result.data.changelog.exists).toBe(true);
    expect(result.data.changelog.lastModified).toBeInstanceOf(Date);
  });

  it("detects CONTRIBUTING.md existence", async () => {
    const collector = new DocsCollector();
    const result = await collector.collect(fullDir);

    expect(result.data.contributing.exists).toBe(true);
    expect(result.data.contributing.lastModified).toBeInstanceOf(Date);
  });

  it("detects LICENSE existence", async () => {
    const collector = new DocsCollector();
    const result = await collector.collect(fullDir);

    expect(result.data.license.exists).toBe(true);
    expect(result.data.license.lastModified).toBeInstanceOf(Date);
  });

  it("detects MIT license type", async () => {
    const collector = new DocsCollector();
    const result = await collector.collect(fullDir);

    expect(result.data.license.type).toBe("MIT");
  });

  it("returns exists=false for all docs in empty directory", async () => {
    const collector = new DocsCollector();
    const result = await collector.collect(emptyDir);

    expect(result.data.readme.exists).toBe(false);
    expect(result.data.changelog.exists).toBe(false);
    expect(result.data.contributing.exists).toBe(false);
    expect(result.data.license.exists).toBe(false);
  });

  it("returns no description when readme does not exist", async () => {
    const collector = new DocsCollector();
    const result = await collector.collect(emptyDir);

    expect(result.data.readme.description).toBeUndefined();
    expect(result.data.readme.lastModified).toBeUndefined();
  });

  it("detects Apache license type", async () => {
    const apacheDir = await mkdtemp(join(tmpdir(), "beacon-docs-apache-"));
    try {
      await writeFile(
        join(apacheDir, "LICENSE"),
        "Apache License\nVersion 2.0, January 2004\nAPACHE LICENSE, VERSION 2.0\n"
      );
      const collector = new DocsCollector();
      const result = await collector.collect(apacheDir);
      expect(result.data.license.exists).toBe(true);
      expect(result.data.license.type).toBe("Apache-2.0");
    } finally {
      await rm(apacheDir, { recursive: true, force: true });
    }
  });

  it("returns undefined license type for unknown license", async () => {
    const customDir = await mkdtemp(join(tmpdir(), "beacon-docs-custom-"));
    try {
      await writeFile(
        join(customDir, "LICENSE"),
        "This is a custom proprietary license. All rights reserved."
      );
      const collector = new DocsCollector();
      const result = await collector.collect(customDir);
      expect(result.data.license.exists).toBe(true);
      expect(result.data.license.type).toBeUndefined();
    } finally {
      await rm(customDir, { recursive: true, force: true });
    }
  });

  it("extracts description skipping badge lines", async () => {
    const badgeDir = await mkdtemp(join(tmpdir(), "beacon-docs-badge-"));
    try {
      await writeFile(
        join(badgeDir, "README.md"),
        [
          "# Project Name",
          "",
          "[![Build Status](https://img.shields.io/badge/build-passing-green.svg)]()",
          "[![npm version](https://badge.fury.io/js/project.svg)]()",
          "",
          "A CLI tool for managing projects.",
          "",
          "## Usage",
        ].join("\n")
      );
      const collector = new DocsCollector();
      const result = await collector.collect(badgeDir);
      expect(result.data.readme.description).toBe(
        "A CLI tool for managing projects."
      );
    } finally {
      await rm(badgeDir, { recursive: true, force: true });
    }
  });

  it("handles README with no paragraph after title", async () => {
    const noDescDir = await mkdtemp(join(tmpdir(), "beacon-docs-nodesc-"));
    try {
      await writeFile(
        join(noDescDir, "README.md"),
        ["# Just a Title", "", "## Section 1", "", "Some content."].join("\n")
      );
      const collector = new DocsCollector();
      const result = await collector.collect(noDescDir);
      // No plain paragraph before the first heading, so description is undefined
      expect(result.data.readme.exists).toBe(true);
      expect(result.data.readme.description).toBeUndefined();
    } finally {
      await rm(noDescDir, { recursive: true, force: true });
    }
  });
});
