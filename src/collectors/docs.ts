import { readFile, stat } from "fs/promises";
import { join } from "path";
import type { Collector, CollectorResult } from "./types.js";

export interface DocsData {
  readme: { exists: boolean; description?: string; lastModified?: Date };
  changelog: { exists: boolean; lastModified?: Date };
  contributing: { exists: boolean; lastModified?: Date };
  license: { exists: boolean; type?: string; lastModified?: Date };
}

async function tryStatFile(
  filePath: string
): Promise<{ lastModified: Date } | null> {
  try {
    const fileStat = await stat(filePath);
    return { lastModified: fileStat.mtime };
  } catch {
    return null;
  }
}

async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Extract the first paragraph of real content after the title in a README.
 * Skips: blank lines, headings (# ...), badges ([![...] or [!...) and HTML comments.
 */
function extractReadmeDescription(content: string): string | undefined {
  const lines = content.split("\n");
  let pastTitle = false;

  const paragraphLines: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Skip the first heading (title)
    if (!pastTitle && /^#\s/.test(line)) {
      pastTitle = true;
      continue;
    }

    if (!pastTitle) continue;

    // Stop accumulating once we hit a blank line after we've started a paragraph
    if (line.trim() === "") {
      if (paragraphLines.length > 0) break;
      continue;
    }

    // Stop at sub-headings (whether or not we have content yet)
    if (/^#{1,6}\s/.test(line)) break;
    if (/^\[!\[|^!\[/.test(line.trim())) continue;
    if (/^<!--/.test(line.trim())) continue;

    paragraphLines.push(line.trim());
  }

  if (paragraphLines.length === 0) return undefined;
  return paragraphLines.join(" ");
}

/**
 * Attempt to identify the license type from the LICENSE file content.
 */
function detectLicenseType(content: string): string | undefined {
  const upper = content.toUpperCase();

  if (upper.includes("MIT LICENSE") || upper.includes("THE MIT")) return "MIT";
  if (upper.includes("APACHE LICENSE")) return "Apache-2.0";
  if (
    upper.includes("GNU GENERAL PUBLIC LICENSE") &&
    upper.includes("VERSION 3")
  )
    return "GPL-3.0";
  if (
    upper.includes("GNU GENERAL PUBLIC LICENSE") &&
    upper.includes("VERSION 2")
  )
    return "GPL-2.0";
  if (upper.includes("GNU LESSER GENERAL PUBLIC LICENSE")) return "LGPL";
  if (upper.includes("BSD 2-CLAUSE")) return "BSD-2-Clause";
  if (upper.includes("BSD 3-CLAUSE") || upper.includes("BSD LICENSE"))
    return "BSD-3-Clause";
  if (upper.includes("ISC LICENSE") || upper.includes("ISC ")) return "ISC";
  if (upper.includes("MOZILLA PUBLIC LICENSE")) return "MPL-2.0";
  if (upper.includes("CREATIVE COMMONS")) return "CC";
  if (upper.includes("UNLICENSE") || upper.includes("PUBLIC DOMAIN"))
    return "Unlicense";

  return undefined;
}

const README_NAMES = ["README.md", "README.MD", "readme.md", "Readme.md"];
const CHANGELOG_NAMES = [
  "CHANGELOG.md",
  "CHANGELOG.MD",
  "changelog.md",
  "CHANGES.md",
  "HISTORY.md",
];
const CONTRIBUTING_NAMES = [
  "CONTRIBUTING.md",
  "CONTRIBUTING.MD",
  "contributing.md",
];
const LICENSE_NAMES = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "LICENCE",
  "LICENCE.md",
];

async function findFirstFile(
  dir: string,
  names: string[]
): Promise<{ path: string; lastModified: Date } | null> {
  for (const name of names) {
    const fullPath = join(dir, name);
    const info = await tryStatFile(fullPath);
    if (info) return { path: fullPath, lastModified: info.lastModified };
  }
  return null;
}

export class DocsCollector implements Collector<DocsData> {
  name = "docs";

  async collect(projectPath: string): Promise<CollectorResult<DocsData>> {
    const start = Date.now();

    const [readmeFile, changelogFile, contributingFile, licenseFile] =
      await Promise.all([
        findFirstFile(projectPath, README_NAMES),
        findFirstFile(projectPath, CHANGELOG_NAMES),
        findFirstFile(projectPath, CONTRIBUTING_NAMES),
        findFirstFile(projectPath, LICENSE_NAMES),
      ]);

    // README
    let readme: DocsData["readme"];
    if (readmeFile) {
      const content = await tryReadFile(readmeFile.path);
      const description = content
        ? extractReadmeDescription(content)
        : undefined;
      readme = {
        exists: true,
        description,
        lastModified: readmeFile.lastModified,
      };
    } else {
      readme = { exists: false };
    }

    // CHANGELOG
    const changelog: DocsData["changelog"] = changelogFile
      ? { exists: true, lastModified: changelogFile.lastModified }
      : { exists: false };

    // CONTRIBUTING
    const contributing: DocsData["contributing"] = contributingFile
      ? { exists: true, lastModified: contributingFile.lastModified }
      : { exists: false };

    // LICENSE
    let license: DocsData["license"];
    if (licenseFile) {
      const content = await tryReadFile(licenseFile.path);
      const type = content ? detectLicenseType(content) : undefined;
      license = { exists: true, type, lastModified: licenseFile.lastModified };
    } else {
      license = { exists: false };
    }

    return {
      source: "docs",
      data: { readme, changelog, contributing, license },
      metadata: {
        collectedAt: new Date(),
        duration: Date.now() - start,
      },
    };
  }
}
