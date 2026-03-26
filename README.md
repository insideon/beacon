<p align="center">
  <h1 align="center">Beacon</h1>
  <p align="center">Your codebase has a purpose. Beacon finds it.</p>
  <p align="center">
    <a href="https://github.com/insideon/beacon/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
    <a href="https://www.npmjs.com/package/beacon-ai"><img src="https://img.shields.io/npm/v/beacon-ai.svg" alt="npm version"></a>
    <a href="https://github.com/insideon/beacon/actions"><img src="https://img.shields.io/github/actions/workflow/status/insideon/beacon/beacon.yml?branch=main" alt="CI"></a>
  </p>
</p>

---

Beacon is an AI-powered CLI tool that analyzes your codebase and tells you what to work on next. It reads your git history, code structure, project config, and documentation to generate prioritized task lists and strategic recommendations.

## Features

- **Smart Analysis** — Understands your project's purpose, tech stack, and current state
- **Prioritized Todo Lists** — AI-generated tasks ranked by urgency and impact
- **Strategic Recommendations** — High-level direction for your project's growth
- **Multiple Data Sources** — Git history, code quality, dependencies, documentation
- **5 LLM Providers** — Claude, OpenAI, Google Gemini, GitHub Copilot, OpenRouter
- **Easy Setup** — `beacon login` for interactive API key configuration
- **Result Caching** — Caches results per git commit, skips redundant LLM calls
- **GitHub Action** — Automatic PR analysis with comment posting
- **JSON Output** — Machine-readable output for CI/CD integration

## Quick Start

```bash
# Install globally
npm install -g beacon-ai

# Set up your LLM provider (opens browser for API key)
beacon login

# Analyze your project
beacon
```

`beacon login` will guide you through provider selection:

```
? Select LLM provider:
  > Claude (Anthropic)
    OpenAI
    Google (Gemini)
    GitHub Copilot
    OpenRouter

Get your API key here: https://console.anthropic.com/settings/keys
? Paste your API key: ****
✓ Saved! Run 'beacon analyze' to get started.
```

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `beacon` | Run full analysis (default) |
| `beacon analyze` | Run project analysis with AI recommendations |
| `beacon todo` | Get a prioritized task list |
| `beacon todo --today` | Show only today's top tasks |
| `beacon status` | Quick project overview without AI (no API key needed) |
| `beacon init` | Create a `.beaconrc.json` config file |
| `beacon login` | Set up your LLM provider and API key |

### Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output results as JSON |
| `--verbose` | Show detailed progress logs |
| `--no-cache` | Skip cache and force fresh analysis |
| `-V, --version` | Show version number |
| `-h, --help` | Show help information |

### Example Output

```
🔍 Beacon - my-project

📊 Project Status: Active TypeScript project with 45 files across 8 modules.
   Recent activity shows focus on API endpoints and auth improvements.
   3 TODO items and 1 FIXME found in source code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Today's Tasks (by priority)

 1. 🟠 [high] Add input validation to API endpoints
    → Missing validation on user-facing routes
    Effort: small

 2. 🟠 [high] Resolve FIXME in payment processing
    → Edge case in refund calculation
    Effort: small

 3. 🟡 [medium] Add error handling for external API calls
    → Network failures not gracefully handled
    Effort: medium

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Strategic Suggestions: Consider adding integration tests
   for critical paths before scaling the API layer.
```

## Configuration

Beacon stores API keys securely in `~/.beacon/credentials.json` via `beacon login`. For project-specific settings, create a `.beaconrc.json`:

```json
{
  "llm": {
    "provider": "claude",
    "model": "claude-sonnet-4-6"
  },
  "analyze": {
    "include": ["src/**", "lib/**"],
    "exclude": ["node_modules", "dist", ".git"],
    "maxDepth": 5
  }
}
```

Run `beacon init` to generate this file with defaults.

### Config Resolution Order

1. `.beaconrc.json` in project root (highest priority)
2. `~/.beacon/credentials.json` (set by `beacon login`)
3. Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)

## Architecture

```
Collectors (parallel) → Context Builder → LLM Analyzer → Presenter
```

| Component | Role |
|-----------|------|
| **GitCollector** | Commit history, branches, uncommitted changes |
| **CodeCollector** | File structure, TODO/FIXME comments, line counts |
| **ConfigCollector** | Dependencies, scripts, project metadata |
| **DocsCollector** | README, CHANGELOG, LICENSE presence and content |
| **ContextBuilder** | Assembles collector data into structured context |
| **LLM Analyzer** | Sends context to LLM, validates structured response |
| **Cache** | Stores results by git commit hash in `.beacon/cache/` |
| **Presenter** | Formats output for terminal or JSON |

## Supported Providers

| Provider | Default Model |
|----------|--------------|
| Claude (Anthropic) | claude-sonnet-4-6 |
| OpenAI | gpt-4o |
| Google Gemini | gemini-2.5-flash |
| GitHub Copilot | gpt-4o |
| OpenRouter | anthropic/claude-sonnet-4 |

## GitHub Action

Automatically analyze your codebase on every pull request:

```yaml
name: Beacon Analysis
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: insideon/beacon@v1
        with:
          provider: claude
          api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `provider` | no | `claude` | LLM provider name |
| `api-key` | yes | — | API key for the provider |
| `model` | no | provider default | LLM model override |

## Development

```bash
# Clone the repository
git clone https://github.com/insideon/beacon.git
cd beacon

# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
