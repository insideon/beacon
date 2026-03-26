import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { mkdtemp, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// ---- helpers ----------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "beacon-cli-test-"));
  vi.resetModules();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetModules();
});

// Shared minimal fake context
function makeFakeContext(name: string = "test-project") {
  return {
    project: { name, purpose: "testing", techStack: ["TypeScript"] },
    activity: { recentCommits: [], activeBranches: [], uncommittedChanges: [] },
    health: { todos: [], outdatedDeps: [] },
    docs: { hasReadme: true, hasChangelog: false },
  };
}

// ---- initCommand ------------------------------------------------------------

describe("initCommand", () => {
  it("creates .beaconrc.json in the project directory", async () => {
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    const { initCommand } = await import("../commands/init.js");
    await initCommand();

    cwdSpy.mockRestore();

    const content = await readFile(join(tempDir, ".beaconrc.json"), "utf-8");
    const config = JSON.parse(content) as Record<string, unknown>;

    expect(config).toHaveProperty("llm");
    expect(config).toHaveProperty("analyze");

    const llm = config["llm"] as Record<string, unknown>;
    expect(llm["provider"]).toBe("claude");
    expect(llm["model"]).toBe("claude-sonnet-4-6");
  });

  it("prints a message when config already exists", async () => {
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { initCommand } = await import("../commands/init.js");
    // First run creates config
    await initCommand();
    // Second run should print "already exists"
    await initCommand();

    cwdSpy.mockRestore();

    const calls = consoleSpy.mock.calls.map((c) => String(c[0]));
    const alreadyExistsCall = calls.find((msg) =>
      msg.includes("already exists")
    );
    expect(alreadyExistsCall).toBeDefined();
  });
});

// ---- statusCommand ----------------------------------------------------------

describe("statusCommand", () => {
  it("outputs JSON context when --json flag is set", async () => {
    const fakeContext = makeFakeContext("test-project");

    vi.doMock("../../context/builder.js", () => ({
      ContextBuilder: vi.fn().mockImplementation(() => ({
        build: vi.fn().mockResolvedValue(fakeContext),
      })),
    }));

    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { statusCommand } = await import("../commands/status.js");
    await statusCommand({ json: true });

    cwdSpy.mockRestore();

    expect(consoleSpy).toHaveBeenCalledOnce();
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as typeof fakeContext;
    expect(parsed.project.name).toBe("test-project");
    expect(parsed.docs.hasReadme).toBe(true);
  });

  it("outputs terminal-formatted text when no --json flag", async () => {
    const fakeContext = {
      project: {
        name: "my-app",
        purpose: "A test app",
        techStack: ["TypeScript", "ESLint"],
      },
      activity: {
        recentCommits: [
          {
            hash: "abc123",
            message: "fix: something",
            author: "dev",
            date: new Date(Date.now() - 3600_000),
          },
        ],
        activeBranches: [],
        uncommittedChanges: [],
      },
      health: { todos: [], outdatedDeps: [] },
      docs: { hasReadme: true, hasChangelog: true, lastDocUpdate: new Date() },
    };

    vi.doMock("../../context/builder.js", () => ({
      ContextBuilder: vi.fn().mockImplementation(() => ({
        build: vi.fn().mockResolvedValue(fakeContext),
      })),
    }));

    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { statusCommand } = await import("../commands/status.js");
    await statusCommand({ json: false });

    cwdSpy.mockRestore();

    expect(consoleSpy).toHaveBeenCalledOnce();
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    // The terminal output should contain the project name
    expect(output).toContain("my-app");
  });
});

// ---- analyzeCommand error handling ------------------------------------------

describe("analyzeCommand", () => {
  it("exits with code 1 and prints login hint when API key is missing", async () => {
    // Mock resolveApiKey to return undefined (no key found)
    vi.doMock("../../config/loader.js", async (importOriginal) => {
      const actual = await importOriginal() as Record<string, unknown>;
      return {
        ...actual,
        resolveApiKey: vi.fn().mockResolvedValue(undefined),
      };
    });

    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: string | number | null | undefined) => {
        throw new Error("process.exit called");
      });

    const { analyzeCommand } = await import("../commands/analyze.js");

    await expect(analyzeCommand({ json: false })).rejects.toThrow(
      "process.exit called"
    );

    cwdSpy.mockRestore();

    expect(exitSpy).toHaveBeenCalledWith(1);

    const errorMessages = consoleErrorSpy.mock.calls
      .map((c) => String(c[0]))
      .join("\n");
    expect(errorMessages).toContain("No API key found");
    expect(errorMessages).toContain("beacon login");
  });
});

// ---- todoCommand error handling ---------------------------------------------

describe("todoCommand", () => {
  it("exits with code 1 and prints login hint when API key is missing", async () => {
    vi.doMock("../../config/loader.js", async (importOriginal) => {
      const actual = await importOriginal() as Record<string, unknown>;
      return {
        ...actual,
        resolveApiKey: vi.fn().mockResolvedValue(undefined),
      };
    });

    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: string | number | null | undefined) => {
        throw new Error("process.exit called");
      });

    const { todoCommand } = await import("../commands/todo.js");

    await expect(todoCommand({ json: false, today: false })).rejects.toThrow(
      "process.exit called"
    );

    cwdSpy.mockRestore();

    expect(exitSpy).toHaveBeenCalledWith(1);

    const errorMessages = consoleErrorSpy.mock.calls
      .map((c) => String(c[0]))
      .join("\n");
    expect(errorMessages).toContain("No API key found");
    expect(errorMessages).toContain("beacon login");
  });
});
