import { readFile, stat } from "fs/promises";
import { join, extname, relative } from "path";
import { glob } from "glob";
import type { Collector, CollectorResult } from "./types.js";
import type { TodoItem } from "../context/types.js";

export interface CodeData {
  files: Array<{ path: string; size: number; lines: number }>;
  todos: TodoItem[];
  summary: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
  };
}

const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".rb": "Ruby",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".c": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".h": "C/C++ Header",
  ".cs": "C#",
  ".php": "PHP",
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".less": "Less",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".md": "Markdown",
  ".mdx": "MDX",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".sql": "SQL",
  ".graphql": "GraphQL",
  ".gql": "GraphQL",
  ".proto": "Protobuf",
  ".tf": "Terraform",
  ".r": "R",
  ".R": "R",
};

const TODO_PATTERN = /(?:\/\/|#|\/\*)\s*(TODO|FIXME|HACK|XXX)[:\s]+(.*)/;

export interface CodeCollectorOptions {
  include?: string[];
  exclude?: string[];
}

export class CodeCollector implements Collector<CodeData> {
  name = "code";
  private options: CodeCollectorOptions;

  constructor(includeOrOptions?: string[] | CodeCollectorOptions, exclude?: string[]) {
    if (Array.isArray(includeOrOptions)) {
      this.options = { include: includeOrOptions, exclude };
    } else {
      this.options = includeOrOptions ?? {};
    }
  }

  async collect(projectPath: string): Promise<CollectorResult<CodeData>> {
    const start = Date.now();

    const includePatterns = this.options.include ?? ["**/*"];
    const excludePatterns = this.options.exclude ?? [
      "node_modules/**",
      ".git/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "**/*.min.js",
      "**/*.map",
    ];

    // Gather all matching files
    const allFiles: string[] = [];
    for (const pattern of includePatterns) {
      const matches = await glob(pattern, {
        cwd: projectPath,
        ignore: excludePatterns,
        nodir: true,
        dot: false,
      });
      allFiles.push(...matches);
    }

    // Deduplicate
    const uniqueFiles = [...new Set(allFiles)];

    const files: CodeData["files"] = [];
    const todos: TodoItem[] = [];
    const languageCounts: Record<string, number> = {};

    await Promise.all(
      uniqueFiles.map(async (relPath) => {
        const fullPath = join(projectPath, relPath);

        try {
          const fileStat = await stat(fullPath);
          if (!fileStat.isFile()) return;

          const content = await readFile(fullPath, "utf-8");
          const lines = content.split("\n");
          const lineCount = lines.length;

          files.push({
            path: relative(projectPath, fullPath),
            size: fileStat.size,
            lines: lineCount,
          });

          // Language detection
          const ext = extname(relPath).toLowerCase();
          const language = LANGUAGE_MAP[ext];
          if (language) {
            languageCounts[language] = (languageCounts[language] ?? 0) + 1;
          }

          // TODO/FIXME/HACK/XXX scanning
          lines.forEach((lineText, idx) => {
            const match = TODO_PATTERN.exec(lineText);
            if (match) {
              const type = match[1] as TodoItem["type"];
              const text = match[2].trim();
              todos.push({
                file: relative(projectPath, fullPath),
                line: idx + 1,
                text,
                type,
              });
            }
          });
        } catch {
          // Skip files that can't be read
        }
      })
    );

    const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

    return {
      source: "code",
      data: {
        files,
        todos,
        summary: {
          totalFiles: files.length,
          totalLines,
          languages: languageCounts,
        },
      },
      metadata: {
        collectedAt: new Date(),
        duration: Date.now() - start,
      },
    };
  }
}
