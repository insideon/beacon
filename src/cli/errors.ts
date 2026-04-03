/**
 * Maps raw errors to user-friendly messages with actionable hints.
 * Raw error details are only shown with --verbose.
 */

interface UserError {
  message: string;
  hint: string;
}

const errorPatterns: { test: RegExp; error: UserError }[] = [
  {
    test: /rate.?limit|too many requests|429/i,
    error: {
      message: "API rate limit exceeded.",
      hint: "Please wait a moment and try again, or check your plan's usage limits.",
    },
  },
  {
    test: /api.?key|unauthorized|401|403/i,
    error: {
      message: "Authentication failed.",
      hint: "Run 'beacon login' to set up or refresh your API key.",
    },
  },
  {
    test: /Ollama API error|Is Ollama running/i,
    error: {
      message: "Could not connect to Ollama.",
      hint: "Make sure Ollama is running (ollama serve) and try again.",
    },
  },
  {
    test: /network|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed/i,
    error: {
      message: "Could not reach the API server.",
      hint: "Check your internet connection and try again.",
    },
  },
  {
    test: /Failed to parse LLM response|does not match expected schema/i,
    error: {
      message: "Received an unexpected response from the AI.",
      hint: "Try running again. If the problem persists, try a different model.",
    },
  },
  {
    test: /Failed to load prompt template/i,
    error: {
      message: "Internal error: missing prompt template.",
      hint: "Try reinstalling beacon with 'npm install -g beacon'.",
    },
  },
  {
    test: /Unknown LLM provider/i,
    error: {
      message: "Unsupported LLM provider.",
      hint: "Run 'beacon login' to configure a supported provider.",
    },
  },
];

export function handleCliError(error: unknown, verbose?: boolean): never {
  if (!(error instanceof Error)) {
    console.error("An unexpected error occurred.");
    process.exit(1);
  }

  const raw = error.message;
  const matched = errorPatterns.find((p) => p.test.test(raw));

  if (matched) {
    console.error(`Error: ${matched.error.message}`);
    console.error(`Hint: ${matched.error.hint}`);
  } else {
    console.error("An unexpected error occurred.");
    console.error("Hint: Run with --verbose for more details, or report this issue.");
  }

  if (verbose) {
    console.error(`\nDetails: ${raw}`);
  }

  process.exit(1);
}
