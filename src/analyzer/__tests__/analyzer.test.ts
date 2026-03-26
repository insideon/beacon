import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProvider } from "../index.js";

// Mock the Anthropic SDK before importing ClaudeProvider
vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
    __mockCreate: mockCreate,
  };
});

// Mock the Google Generative AI SDK
vi.mock("@google/generative-ai", () => {
  const mockGenerateContent = vi.fn();
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    })),
    __mockGenerateContent: mockGenerateContent,
  };
});

// Mock the OpenAI SDK before importing OpenAIProvider
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    __mockCreate: mockCreate,
  };
});

describe("createProvider", () => {
  it("returns a ClaudeProvider when provider is 'claude'", () => {
    const provider = createProvider("claude", "test-key");
    expect(provider.name).toBe("claude");
  });

  it("returns an OpenAIProvider when provider is 'openai'", () => {
    const provider = createProvider("openai", "test-key");
    expect(provider.name).toBe("openai");
  });

  it("returns a GoogleProvider when provider is 'google'", () => {
    const provider = createProvider("google", "test-key");
    expect(provider.name).toBe("google");
  });

  it("returns a CopilotProvider when provider is 'copilot'", () => {
    const provider = createProvider("copilot", "test-key");
    expect(provider.name).toBe("copilot");
  });

  it("returns an OpenRouterProvider when provider is 'openrouter'", () => {
    const provider = createProvider("openrouter", "test-key");
    expect(provider.name).toBe("openrouter");
  });

  it("throws for unknown provider", () => {
    expect(() =>
      createProvider("unknown", "test-key")
    ).toThrow("Unknown LLM provider: unknown");
  });
});

describe("ClaudeProvider", () => {
  const mockValidResponse = {
    summary: "Project is in good health.",
    recommendations: [
      {
        title: "Fix outdated dep",
        description: "Update the outdated package",
        priority: "high" as const,
        category: "ops" as const,
        effort: "small" as const,
        reasoning: "Security risk",
      },
    ],
    todaysFocus: [
      {
        title: "Fix outdated dep",
        description: "Update the outdated package",
        priority: "high" as const,
        category: "ops" as const,
        effort: "small" as const,
        reasoning: "Quick win today",
      },
    ],
  };

  const makeProjectContext = () => ({
    project: {
      name: "beacon",
      purpose: "AI project analyzer",
      techStack: ["TypeScript"],
    },
    activity: {
      recentCommits: [],
      activeBranches: [],
      uncommittedChanges: [],
    },
    health: {
      todos: [],
      outdatedDeps: [],
    },
    docs: {
      hasReadme: true,
      hasChangelog: false,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls Anthropic API and returns parsed AnalysisResult", async () => {
    // Import the mocked module to access __mockCreate
    const anthropicMod = await import("@anthropic-ai/sdk");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (anthropicMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify(mockValidResponse),
        },
      ],
    });

    const { ClaudeProvider } = await import("../providers/claude.js");
    const provider = new ClaudeProvider("test-key", "claude-sonnet-4-6");
    const result = await provider.analyze(makeProjectContext(), "analyze");

    expect(result.summary).toBe("Project is in good health.");
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].priority).toBe("high");
    expect(result.todaysFocus).toHaveLength(1);
  });

  it("passes the correct model to the Anthropic API", async () => {
    const anthropicMod = await import("@anthropic-ai/sdk");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (anthropicMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify(mockValidResponse),
        },
      ],
    });

    const { ClaudeProvider } = await import("../providers/claude.js");
    const provider = new ClaudeProvider("test-key", "claude-opus-4-5");
    await provider.analyze(makeProjectContext(), "analyze");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-opus-4-5" })
    );
  });

  it("uses default model 'claude-sonnet-4-6' when model not specified", async () => {
    const anthropicMod = await import("@anthropic-ai/sdk");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (anthropicMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify(mockValidResponse),
        },
      ],
    });

    const { ClaudeProvider } = await import("../providers/claude.js");
    const provider = new ClaudeProvider("test-key");
    await provider.analyze(makeProjectContext(), "todo");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-6" })
    );
  });

  it("handles response wrapped in markdown code block", async () => {
    const anthropicMod = await import("@anthropic-ai/sdk");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (anthropicMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    const wrappedJson = "```json\n" + JSON.stringify(mockValidResponse) + "\n```";
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: wrappedJson,
        },
      ],
    });

    const { ClaudeProvider } = await import("../providers/claude.js");
    const provider = new ClaudeProvider("test-key");
    const result = await provider.analyze(makeProjectContext(), "analyze");

    expect(result.summary).toBe("Project is in good health.");
  });

  it("throws when API returns no text content", async () => {
    const anthropicMod = await import("@anthropic-ai/sdk");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (anthropicMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockResolvedValueOnce({
      content: [],
    });

    const { ClaudeProvider } = await import("../providers/claude.js");
    const provider = new ClaudeProvider("test-key");

    await expect(
      provider.analyze(makeProjectContext(), "analyze")
    ).rejects.toThrow("Anthropic API returned no text content in response");
  });

  it("throws when API returns invalid JSON", async () => {
    const anthropicMod = await import("@anthropic-ai/sdk");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (anthropicMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "I'm sorry, I cannot analyze this project.",
        },
      ],
    });

    const { ClaudeProvider } = await import("../providers/claude.js");
    const provider = new ClaudeProvider("test-key");

    await expect(
      provider.analyze(makeProjectContext(), "analyze")
    ).rejects.toThrow("Failed to parse LLM response as JSON");
  });

  it("throws when prompt template file doesn't exist", async () => {
    const { ClaudeProvider } = await import("../providers/claude.js");
    const provider = new ClaudeProvider("test-key");

    // The error is thrown before the API is called (reading the template file fails)
    await expect(
      provider.analyze(makeProjectContext(), "nonexistent-prompt-type")
    ).rejects.toThrow('Failed to load prompt template "nonexistent-prompt-type"');
  });

  it("propagates API errors", async () => {
    const anthropicMod = await import("@anthropic-ai/sdk");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (anthropicMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    const { ClaudeProvider } = await import("../providers/claude.js");
    const provider = new ClaudeProvider("test-key");

    await expect(
      provider.analyze(makeProjectContext(), "analyze")
    ).rejects.toThrow("API rate limit exceeded");
  });
});

describe("OpenAIProvider", () => {
  const mockValidResponse = {
    summary: "Project is in good health.",
    recommendations: [
      {
        title: "Fix outdated dep",
        description: "Update the outdated package",
        priority: "high" as const,
        category: "ops" as const,
        effort: "small" as const,
        reasoning: "Security risk",
      },
    ],
    todaysFocus: [
      {
        title: "Fix outdated dep",
        description: "Update the outdated package",
        priority: "high" as const,
        category: "ops" as const,
        effort: "small" as const,
        reasoning: "Quick win today",
      },
    ],
  };

  const makeProjectContext = () => ({
    project: {
      name: "beacon",
      purpose: "AI project analyzer",
      techStack: ["TypeScript"],
    },
    activity: {
      recentCommits: [],
      activeBranches: [],
      uncommittedChanges: [],
    },
    health: {
      todos: [],
      outdatedDeps: [],
    },
    docs: {
      hasReadme: true,
      hasChangelog: false,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls OpenAI API and returns parsed AnalysisResult", async () => {
    const openaiMod = await import("openai");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (openaiMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockValidResponse),
          },
        },
      ],
    });

    const { OpenAIProvider } = await import("../providers/openai.js");
    const provider = new OpenAIProvider("test-key", "gpt-4o");
    const result = await provider.analyze(makeProjectContext(), "analyze");

    expect(result.summary).toBe("Project is in good health.");
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].priority).toBe("high");
    expect(result.todaysFocus).toHaveLength(1);
  });

  it("passes the correct model to the OpenAI API", async () => {
    const openaiMod = await import("openai");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (openaiMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockValidResponse),
          },
        },
      ],
    });

    const { OpenAIProvider } = await import("../providers/openai.js");
    const provider = new OpenAIProvider("test-key", "gpt-4.1");
    await provider.analyze(makeProjectContext(), "analyze");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4.1" })
    );
  });

  it("uses default model 'gpt-4o' when model not specified", async () => {
    const openaiMod = await import("openai");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (openaiMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockValidResponse),
          },
        },
      ],
    });

    const { OpenAIProvider } = await import("../providers/openai.js");
    const provider = new OpenAIProvider("test-key");
    await provider.analyze(makeProjectContext(), "todo");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o" })
    );
  });

  it("throws when API returns no content", async () => {
    const openaiMod = await import("openai");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (openaiMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: null,
          },
        },
      ],
    });

    const { OpenAIProvider } = await import("../providers/openai.js");
    const provider = new OpenAIProvider("test-key");

    await expect(
      provider.analyze(makeProjectContext(), "analyze")
    ).rejects.toThrow("OpenAI API returned no content in response");
  });

  it("propagates API errors", async () => {
    const openaiMod = await import("openai");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = (openaiMod as any).__mockCreate as ReturnType<typeof vi.fn>;

    mockCreate.mockRejectedValueOnce(new Error("Rate limit exceeded"));

    const { OpenAIProvider } = await import("../providers/openai.js");
    const provider = new OpenAIProvider("test-key");

    await expect(
      provider.analyze(makeProjectContext(), "analyze")
    ).rejects.toThrow("Rate limit exceeded");
  });
});
